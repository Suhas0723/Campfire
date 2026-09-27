"""Visa Intelligent Commerce payment boundary.

This app is built against Visa Intelligent Commerce's actual API contract. It runs
on a mock provider because production token requester ID provisioning requires Visa
account manager sign-off outside this hackathon's timeframe. Switching to live Visa
payments requires only setting PAYMENT_PROVIDER=real_vic and the corresponding
credentials — no application code changes.
"""

import base64
import hashlib
import hmac
import json
import logging
import threading
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import formatdate
from urllib.parse import quote

import requests
from flask import current_app

logger = logging.getLogger(__name__)

VIC_TEST_HOST = "apitest.visaacceptance.com"
VIC_CREDENTIALS = (
    "ORG_ID",
    "API_KEY",
    "SHARED_SECRET",
    "TOKEN_REQUESTER_ID",
    "RELATIONSHIP_ID",
)
_CONFIG_FOR_ENV = {
    "ORG_ID": "VIC_ORG_ID",
    "API_KEY": "VIC_API_KEY",
    "SHARED_SECRET": "VIC_SHARED_SECRET",
    "TOKEN_REQUESTER_ID": "VIC_TOKEN_REQUESTER_ID",
    "RELATIONSHIP_ID": "VIC_RELATIONSHIP_ID",
}

# Seeded demo instruments. tokenized_card is a 32-char hex network token, the
# same shape as tokenizedCard.number / VISA_ACCEPTANCE_TOKENIZED_CARD, not a PAN.
DEMO_PROFILES = {
    "vic-demo-priya": {
        "first_name": "Priya",
        "last_name": "Shah",
        "email": "priya.shah@example.com",
        "phone_number": "5550100001",
        "country": "US",
        "balance": "1840.55",
        "currency": "USD",
        "masked": {"suffix": "1881", "expirationMonth": "08", "expirationYear": "2028", "type": "001"},
    },
    "vic-demo-dev": {
        "first_name": "Dev",
        "last_name": "Patel",
        "email": "dev.patel@example.com",
        "phone_number": "5550100002",
        "country": "US",
        "balance": "960.40",
        "currency": "USD",
        "masked": {"suffix": "4417", "expirationMonth": "03", "expirationYear": "2027", "type": "001"},
    },
    "vic-demo-marcus": {
        "first_name": "Marcus",
        "last_name": "Bennett",
        "email": "marcus.bennett@example.com",
        "phone_number": "5550100003",
        "country": "US",
        "balance": "3125.10",
        "currency": "USD",
        "masked": {"suffix": "9026", "expirationMonth": "11", "expirationYear": "2029", "type": "001"},
    },
}


class NotConfiguredError(RuntimeError):
    def __init__(self, missing: list[str]):
        self.missing = list(missing)
        super().__init__(
            "Visa Intelligent Commerce is not configured. Missing: "
            + ", ".join(self.missing)
            + ". Set PAYMENT_PROVIDER=mock_vic, or provide ORG_ID, API_KEY, "
            "SHARED_SECRET, TOKEN_REQUESTER_ID, and RELATIONSHIP_ID."
        )


class PaymentDeclinedError(RuntimeError):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


class PaymentProviderError(RuntimeError):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


@dataclass
class EnrollmentResult:
    status: str
    instrument_id: str
    pending_events: list[str]
    client_correlation_id: str

    def to_dict(self) -> dict:
        """Enroll-a-card response. ACTIVE omits pendingEvents, matching Visa's sample."""
        body = {
            "clientCorrelationId": self.client_correlation_id,
            "status": self.status,
        }
        if self.status == "PENDING":
            body["pendingEvents"] = list(self.pending_events)
        return body


@dataclass
class PurchaseIntentResult:
    instruction_id: str
    status: str
    client_correlation_id: str

    def to_dict(self) -> dict:
        return {
            "clientCorrelationId": self.client_correlation_id,
            "instructionId": self.instruction_id,
        }


@dataclass
class PaymentCredentials:
    token_ref: str
    masked_card_info: dict
    client_correlation_id: str
    transaction_id: str
    status: str = "COMPLETED"

    def to_dict(self) -> dict:
        masked = self.masked_card_info or {}
        return {
            "clientCorrelationId": self.client_correlation_id,
            "transactionId": self.transaction_id,
            "status": self.status,
            "tokenizedCard": {
                "number": self.token_ref,
                "expirationMonth": str(masked.get("expirationMonth") or ""),
                "expirationYear": str(masked.get("expirationYear") or ""),
                "type": str(masked.get("type") or "001"),
            },
        }


@dataclass
class ConfirmationResult:
    status: str
    client_correlation_id: str
    transaction_id: str
    signed_payload: str

    def to_dict(self) -> dict:
        return {
            "clientCorrelationId": self.client_correlation_id,
            "transactionId": self.transaction_id,
            "status": self.status,
            "signedPayload": self.signed_payload,
        }


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    def enroll_card(self, customer_id, billing_info, device_info) -> EnrollmentResult:
        raise NotImplementedError

    @abstractmethod
    def initiate_purchase_intent(self, instrument_id, purchase_details) -> PurchaseIntentResult:
        raise NotImplementedError

    @abstractmethod
    def retrieve_payment_credentials(self, instruction_id) -> PaymentCredentials:
        raise NotImplementedError

    @abstractmethod
    def confirm_transaction(self, instruction_id, outcome) -> ConfirmationResult:
        raise NotImplementedError


class MockVICProvider(PaymentProvider):
    """In-memory stand-in whose responses use Visa's Intelligent Commerce field names."""

    name = "mock_vic"

    def __init__(self):
        self._lock = threading.Lock()
        self._enrollments: dict[str, dict] = {}
        self._intents: dict[str, dict] = {}

    def enroll_card(self, customer_id, billing_info, device_info) -> EnrollmentResult:
        instrument_id = instrument_id_from_billing(billing_info) or _generated_instrument(str(customer_id))
        correlation = _correlation(f"enroll:{customer_id}:{instrument_id}")
        delay = float(current_app.config.get("MOCK_VIC_ENROLL_DELAY_SECONDS", 0) or 0)
        now = time.monotonic()
        with self._lock:
            state = self._enrollments.get(instrument_id)
            if state is None:
                state = {"started": now}
                self._enrollments[instrument_id] = state
            pending = delay > 0 and (now - float(state["started"])) < delay
        if pending:
            logger.info("VIC mock enrollment %s status=PENDING", instrument_id)
            return EnrollmentResult(
                status="PENDING",
                instrument_id=instrument_id,
                pending_events=["PENDING_CARDHOLDER_AUTHENTICATION"],
                client_correlation_id=correlation,
            )
        logger.info("VIC mock enrollment %s status=ACTIVE", instrument_id)
        return EnrollmentResult(
            status="ACTIVE",
            instrument_id=instrument_id,
            pending_events=[],
            client_correlation_id=correlation,
        )

    def initiate_purchase_intent(self, instrument_id, purchase_details) -> PurchaseIntentResult:
        details = dict(purchase_details or {})
        amount = _as_amount(details.get("amount"))
        max_price = _as_amount(details.get("max_price", amount))
        if amount > max_price:
            raise PaymentDeclinedError("amount_exceeds_user_instruction")
        profile = _profile(instrument_id)
        if amount > _as_amount(profile["balance"]):
            raise PaymentDeclinedError("insufficient_funds")
        if current_app.config.get("MOCK_VIC_DECLINE"):
            raise PaymentDeclinedError("mock_authorization_declined")
        instruction_id = str(uuid.uuid4())
        correlation = _correlation(f"intent:{instruction_id}")
        with self._lock:
            self._intents[instruction_id] = {
                "instrument_id": str(instrument_id),
                "purchase_details": details,
                "token_ref": _tokenized_card_number(str(instrument_id)),
                "masked": dict(profile["masked"]),
                "status": "ACTIVE",
                "client_correlation_id": correlation,
            }
        return PurchaseIntentResult(
            instruction_id=instruction_id,
            status="ACTIVE",
            client_correlation_id=correlation,
        )

    def retrieve_payment_credentials(self, instruction_id) -> PaymentCredentials:
        with self._lock:
            intent = self._intents.get(str(instruction_id))
        if intent is None:
            raise PaymentProviderError("unknown_instruction_id")
        correlation = _correlation(f"credentials:{instruction_id}")
        return PaymentCredentials(
            token_ref=intent["token_ref"],
            masked_card_info=dict(intent["masked"]),
            client_correlation_id=correlation,
            transaction_id=str(uuid.uuid4()),
            status="COMPLETED",
        )

    def confirm_transaction(self, instruction_id, outcome) -> ConfirmationResult:
        with self._lock:
            intent = self._intents.get(str(instruction_id))
            if intent is None:
                raise PaymentProviderError("unknown_instruction_id")
            intent["status"] = "COMPLETED"
            intent["outcome"] = dict(outcome or {})
        correlation = _correlation(f"confirm:{instruction_id}")
        logger.info(
            "VIC mock transaction confirmed instruction_id=%s status=COMPLETED outcome=%s",
            instruction_id,
            (outcome or {}).get("type") or "PURCHASE",
        )
        return ConfirmationResult(
            status="COMPLETED",
            client_correlation_id=correlation,
            transaction_id=str(uuid.uuid4()),
            signed_payload="jws-signed-payload",
        )


class RealVICProvider(PaymentProvider):
    """Live Intelligent Commerce calls against the Visa Acceptance test host.

    Structurally complete. Requests follow the published enroll, purchase-intent,
    credentials, and confirmation contracts. Construction raises NotConfiguredError
    until ORG_ID, API_KEY, SHARED_SECRET, TOKEN_REQUESTER_ID, and RELATIONSHIP_ID
    are set.
    """

    name = "real_vic"

    def __init__(self, transport=None):
        missing = missing_vic_config()
        if missing:
            raise NotConfiguredError(missing)
        self._transport = transport
        self._intents: dict[str, dict] = {}

    def enroll_card(self, customer_id, billing_info, device_info) -> EnrollmentResult:
        instrument_id = instrument_id_from_billing(billing_info)
        if not instrument_id:
            raise PaymentProviderError("missing_instrument_identifier")
        correlation = str(uuid.uuid4())
        body = self._request(
            "POST",
            "/acp/v1/tokens",
            _enroll_body(customer_id, billing_info, device_info, instrument_id, correlation),
        )
        pending = body.get("pendingEvents") or []
        if isinstance(pending, str):
            pending = [pending]
        return EnrollmentResult(
            status=str(body.get("status") or ""),
            instrument_id=instrument_id,
            pending_events=[str(item) for item in pending],
            client_correlation_id=str(body.get("clientCorrelationId") or correlation),
        )

    def initiate_purchase_intent(self, instrument_id, purchase_details) -> PurchaseIntentResult:
        if not str(instrument_id or "").strip():
            raise PaymentProviderError("missing_instrument_identifier")
        correlation = str(uuid.uuid4())
        payload = _purchase_intent_body(str(instrument_id), purchase_details, correlation)
        body = self._request("POST", "/acp/v1/instructions", payload)
        instruction_id = str(body.get("instructionId") or "")
        if not instruction_id:
            raise PaymentProviderError("purchase_intent_missing_instruction_id")
        self._intents[instruction_id] = {
            "instrument_id": str(instrument_id),
            "tokenized_card_number": payload["tokenizedCard"]["number"],
            "purchase_details": dict(purchase_details or {}),
        }
        return PurchaseIntentResult(
            instruction_id=instruction_id,
            status="ACTIVE",
            client_correlation_id=str(body.get("clientCorrelationId") or correlation),
        )

    def retrieve_payment_credentials(self, instruction_id) -> PaymentCredentials:
        intent = self._intents.get(str(instruction_id))
        if intent is None:
            raise PaymentProviderError("unknown_instruction_id")
        correlation = str(uuid.uuid4())
        body = self._request(
            "POST",
            f"/acp/v1/instructions/{quote(str(instruction_id), safe='')}/credentials",
            _credentials_body(intent, correlation),
        )
        status = str(body.get("status") or "")
        if status not in {"COMPLETED", "SUCCESS"}:
            raise PaymentProviderError(f"payment_credentials_{status.casefold() or 'missing'}")
        card = _tokenized_card(body)
        if card is None or not card.get("number"):
            raise PaymentProviderError("payment_credentials_missing")
        masked = {
            "type": str(card.get("type") or "001"),
            "expirationMonth": str(card.get("expirationMonth") or ""),
            "expirationYear": str(card.get("expirationYear") or ""),
        }
        if card.get("suffix"):
            masked["suffix"] = str(card["suffix"])
        return PaymentCredentials(
            token_ref=str(card["number"]),
            masked_card_info=masked,
            client_correlation_id=str(body.get("clientCorrelationId") or correlation),
            transaction_id=str(body.get("transactionId") or ""),
            status=status,
        )

    def confirm_transaction(self, instruction_id, outcome) -> ConfirmationResult:
        if not str(instruction_id or "").strip():
            raise PaymentProviderError("unknown_instruction_id")
        correlation = str(uuid.uuid4())
        body = self._request(
            "POST",
            f"/acp/v1/instructions/{quote(str(instruction_id), safe='')}/confirmations",
            _confirmation_body(outcome, correlation),
        )
        status = str(body.get("status") or "")
        logger.info(
            "VIC transaction confirmation instruction_id=%s status=%s",
            instruction_id,
            status,
        )
        return ConfirmationResult(
            status=status,
            client_correlation_id=str(body.get("clientCorrelationId") or correlation),
            transaction_id=str(body.get("transactionId") or ""),
            signed_payload=str(body.get("signedPayload") or ""),
        )

    def _request(self, method: str, path: str, payload: dict) -> dict:
        if self._transport is not None:
            body = self._transport(method, path, payload)
            if not isinstance(body, dict):
                raise PaymentProviderError("visa_acceptance_invalid_response")
            return body
        config = current_app.config
        host = VIC_TEST_HOST
        raw = json.dumps(payload, separators=(",", ":")).encode()
        date = formatdate(timeval=None, localtime=False, usegmt=True)
        headers = http_signature_headers(
            method=method,
            host=host,
            path=path,
            body=raw,
            merchant_id=str(config["VIC_ORG_ID"]).strip(),
            key_id=str(config["VIC_API_KEY"]).strip(),
            shared_secret=str(config["VIC_SHARED_SECRET"]).strip(),
            date=date,
        )
        headers["token-requestor-id"] = str(config["VIC_TOKEN_REQUESTER_ID"]).strip()
        headers["relationship-id"] = str(config["VIC_RELATIONSHIP_ID"]).strip()
        try:
            response = requests.request(
                method,
                f"https://{host}{path}",
                data=raw,
                headers=headers,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise PaymentProviderError("visa_acceptance_unreachable") from exc
        if response.status_code >= 400:
            raise PaymentProviderError(_error_reason(response))
        try:
            body = response.json()
        except ValueError as exc:
            raise PaymentProviderError("visa_acceptance_invalid_response") from exc
        if not isinstance(body, dict):
            raise PaymentProviderError("visa_acceptance_invalid_response")
        return body


def get_payment_provider() -> PaymentProvider:
    """Single switch between the mock and live Intelligent Commerce providers."""
    name = str(current_app.config.get("PAYMENT_PROVIDER", "mock_vic")).strip().casefold()
    if name == "mock_vic":
        return MockVICProvider()
    if name == "real_vic":
        return RealVICProvider()
    raise RuntimeError(f"Unsupported payment provider: {name}. Expected mock_vic or real_vic.")


def missing_vic_config() -> list[str]:
    return [name for name in VIC_CREDENTIALS if not str(current_app.config.get(_CONFIG_FOR_ENV[name]) or "").strip()]


def instrument_id_from_billing(billing_info) -> str:
    billing = billing_info or {}
    payment = billing.get("paymentInformation") if isinstance(billing, dict) else None
    payment = payment or {}
    identifier = payment.get("instrumentIdentifier") or billing.get("instrumentIdentifier") or {}
    if not isinstance(identifier, dict):
        identifier = {}
    return str(identifier.get("id") or billing.get("instrument_id") or "").strip()


def http_signature_headers(
    *,
    method: str,
    host: str,
    path: str,
    body: bytes | None,
    merchant_id: str,
    key_id: str,
    shared_secret: str,
    date: str,
) -> dict[str, str]:
    """Sign a Visa Acceptance request with HTTP Signature (HMAC-SHA256)."""
    digest = None
    if body is not None:
        digest = "SHA-256=" + base64.b64encode(hashlib.sha256(body).digest()).decode()
    lines = [
        f"host: {host}",
        f"date: {date}",
        f"(request-target): {method.casefold()} {path}",
    ]
    header_names = ["host", "date", "(request-target)"]
    if digest is not None:
        lines.append(f"digest: {digest}")
        header_names.append("digest")
    lines.append(f"v-c-merchant-id: {merchant_id}")
    header_names.append("v-c-merchant-id")
    signature = signature_for_signing_string("\n".join(lines), shared_secret)
    headers = {
        "Host": host,
        "Date": date,
        "v-c-merchant-id": merchant_id,
        "Content-Type": "application/json",
        "Signature": (
            f'keyid="{key_id}", algorithm="HmacSHA256", '
            f'headers="{" ".join(header_names)}", signature="{signature}"'
        ),
    }
    if digest is not None:
        headers["Digest"] = digest
    return headers


def signature_for_signing_string(signing: str, shared_secret: str) -> str:
    key = base64.b64decode(shared_secret)
    return base64.b64encode(hmac.new(key, signing.encode(), hashlib.sha256).digest()).decode()


def _profile(instrument_id: str) -> dict:
    known = DEMO_PROFILES.get(str(instrument_id))
    if known is not None:
        return known
    return {
        "first_name": "Campfire",
        "last_name": "Traveler",
        "email": "traveler@example.com",
        "phone_number": "5550100000",
        "country": "US",
        "balance": "500.00",
        "currency": "USD",
        "masked": {"suffix": "4242", "expirationMonth": "12", "expirationYear": "2028", "type": "001"},
    }


def _tokenized_card_number(instrument_id: str) -> str:
    digest = hashlib.sha256(f"visa-acceptance-tokenized-card:{instrument_id}".encode()).hexdigest()
    token = digest[:32]
    if token.isdigit():
        token = token[:-1] + "a"
    return token


def _generated_instrument(customer_id: str) -> str:
    return hashlib.sha256(f"vic-instrument:{customer_id}".encode()).hexdigest()[:32].upper()


def _correlation(value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, value))


def _as_amount(value) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def _device_information(device_info, correlation: str, country: str) -> dict:
    device = device_info or {}
    device_data = device.get("deviceData") or {}
    return {
        "userAgent": device.get("userAgent") or "Campfire",
        "applicationName": device.get("applicationName") or "Campfire",
        "fingerprintSessionId": device.get("fingerprintSessionId") or correlation,
        "country": device.get("country") or country or "US",
        "deviceData": {
            "type": device_data.get("type") or "Mobile",
            "manufacturer": device_data.get("manufacturer") or "Campfire",
            "brand": device_data.get("brand") or "Campfire",
            "model": device_data.get("model") or "Web",
        },
        "ipAddress": device.get("ipAddress") or "127.0.0.1",
        "clientDeviceId": device.get("clientDeviceId") or correlation.replace("-", ""),
    }


def _assurance_data(correlation: str) -> dict:
    return {
        "verificationType": "DEVICE",
        "verificationEntity": "10",
        "verificationEvents": ["01"],
        "verificationMethod": "02",
        "verificationResults": "01",
        "verificationTimestamp": str(int(datetime.now(timezone.utc).timestamp())),
        "authenticationContext": {"action": "AUTHENTICATE"},
        "authenticatedIdentities": {
            "data": correlation,
            "provider": "VISA_PAYMENT_PASSKEY",
            "id": correlation,
        },
        "additionalData": "",
    }


def _enroll_body(customer_id, billing_info, device_info, instrument_id: str, correlation: str) -> dict:
    billing = dict(billing_info or {})
    country = billing.get("country") or "US"
    email = billing.get("email") or "traveler@example.com"
    return {
        "clientCorrelationId": correlation,
        "deviceInformation": _device_information(device_info, correlation, country),
        "buyerInformation": {
            "merchantCustomerId": str(customer_id),
            "language": billing.get("language") or "en",
        },
        "billTo": {
            "firstName": billing.get("firstName") or "Campfire",
            "lastName": billing.get("lastName") or "Traveler",
            "email": email,
            "countryCallingCode": str(billing.get("countryCallingCode") or "1"),
            "phoneNumber": str(billing.get("phoneNumber") or "5550100000"),
            "numberIsVoiceOnly": False,
            "country": country,
        },
        "consumerIdentity": {
            "identityType": "EMAIL_ADDRESS",
            "identityValue": email,
            "identityProvider": "PARTNER",
            "identityProviderUrl": billing.get("identityProviderUrl") or "https://example.com",
        },
        "paymentInformation": {
            "customer": {"id": ""},
            "paymentInstrument": {"id": ""},
            "instrumentIdentifier": {"id": instrument_id},
        },
    }


def _purchase_intent_body(instrument_id: str, purchase_details, correlation: str) -> dict:
    details = dict(purchase_details or {})
    amount = _as_amount(details.get("max_price", details.get("amount")))
    currency = str(details.get("currency") or "USD")
    until = datetime.now(timezone.utc) + timedelta(days=1)
    token_number = str(details.get("tokenized_card_number") or instrument_id).strip()
    description = str(details.get("item") or details.get("description") or "Campfire booking")[:255]
    return {
        "clientCorrelationId": correlation,
        "paymentInformation": {
            "customer": {"id": ""},
            "paymentInstrument": {"id": ""},
            "instrumentIdentifier": {"id": instrument_id},
        },
        "deviceInformation": _device_information(details.get("deviceInformation"), correlation, "US"),
        "tokenizedCard": {"number": token_number},
        "assuranceData": [_assurance_data(correlation)],
        "mandates": [
            {
                "mandateId": correlation,
                "declineThreshold": {"amount": f"{amount:.2f}", "currencyCode": currency},
                "effectiveUntilTime": str(int(until.timestamp())),
                "description": description,
            }
        ],
        "buyerInformation": {"merchantCustomerId": str(details.get("customer_id") or "")},
        "consumerPrompt": f"Authorize {currency} {_as_amount(details.get('amount')):.2f} for {description}"[:255],
    }


def _credentials_body(intent: dict, correlation: str) -> dict:
    details = dict(intent.get("purchase_details") or {})
    return {
        "clientCorrelationId": correlation,
        "paymentInformation": {"instrumentIdentifier": {"id": intent["instrument_id"]}},
        "tokenizedCard": {"number": intent["tokenized_card_number"]},
        "transactionData": [
            _transaction_data(
                correlation,
                {
                    "totalAmount": details.get("amount") or "0.00",
                    "currency": details.get("currency") or "USD",
                    "merchantName": details.get("merchantName") or "Campfire",
                    "merchantUrl": details.get("merchantUrl") or "https://example.com",
                    "merchantCountry": details.get("merchantCountry") or "US",
                    "code": details.get("code"),
                    "type": "PURCHASE",
                },
            )
        ],
    }


def _confirmation_body(outcome, correlation: str) -> dict:
    return {
        "clientCorrelationId": correlation,
        "transactionData": [_transaction_data(correlation, outcome or {})],
    }


def _transaction_data(correlation: str, outcome: dict) -> dict:
    currency = str(outcome.get("currency") or "USD")
    amount = outcome.get("totalAmount") or "0.00"
    merchant_url = str(outcome.get("merchantUrl") or "https://example.com")
    code = str(outcome.get("code") or correlation.replace("-", ""))[:25]
    return {
        "clientReferenceInformation": {"code": code},
        "type": str(outcome.get("type") or "PURCHASE"),
        "transactionType": "PURCHASE",
        "orderInformation": {
            "amountDetail": {
                "totalAmount": str(amount),
                "currency": currency,
            }
        },
        "merchantInformation": {
            "merchantName": str(outcome.get("merchantName") or "Campfire"),
            "merchantDescriptor": {
                "country": str(outcome.get("merchantCountry") or "US"),
                "url": merchant_url,
            },
        },
    }


def _tokenized_card(payload: dict) -> dict | None:
    found = []
    tokenized = payload.get("tokenizedCard")
    if isinstance(tokenized, dict):
        found.append(tokenized)
    payment = payload.get("paymentInformation") or {}
    if isinstance(payment, dict) and isinstance(payment.get("tokenizedCard"), dict):
        found.append(payment["tokenizedCard"])
    for item in payload.get("paymentCredentials") or []:
        if isinstance(item, dict):
            card = item.get("tokenizedCard") or item
            if isinstance(card, dict):
                found.append(card)
    for card in found:
        if card.get("number"):
            return card
    return None


def _error_reason(response: requests.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        body = {}
    if isinstance(body, dict):
        reason = body.get("reason") or body.get("message") or body.get("status")
        if reason:
            logger.info("Visa Acceptance HTTP %s: %s", response.status_code, reason)
            return str(reason)[:180]
    logger.info("Visa Acceptance HTTP %s", response.status_code)
    return f"http_{response.status_code}"
