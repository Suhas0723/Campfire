"""Payment provider boundary modeled after Visa Intelligent Commerce."""

import base64
import hashlib
import hmac
import json
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from email.utils import formatdate
from urllib.parse import quote

import requests
from flask import current_app

logger = logging.getLogger(__name__)

AUTHORIZED_STATUSES = {"AUTHORIZED", "AUTHORIZED_PENDING_REVIEW", "PARTIAL_AUTHORIZED"}


@dataclass(frozen=True)
class UserInstruction:
    idempotency_key: str
    item: str
    book_ref: str
    amount: float
    max_price: float
    currency: str
    approval_message_id: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class AuthorizationResult:
    approved: bool
    authorization_ref: str | None
    amount: float
    currency: str
    reason: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class PaymentProvider(ABC):
    @abstractmethod
    def authorize(self, *, token_ref: str, instruction: UserInstruction) -> AuthorizationResult:
        raise NotImplementedError

    @abstractmethod
    def void(self, *, token_ref: str, authorization_ref: str) -> dict:
        """Release an authorization when downstream booking cannot complete."""
        raise NotImplementedError


class MockVisaIntelligentCommerceProvider(PaymentProvider):
    """Deterministic stand-in for a token-scoped VIC authorization."""

    def authorize(self, *, token_ref: str, instruction: UserInstruction) -> AuthorizationResult:
        if instruction.amount > instruction.max_price:
            return AuthorizationResult(
                approved=False,
                authorization_ref=None,
                amount=instruction.amount,
                currency=instruction.currency,
                reason="amount_exceeds_user_instruction",
            )
        if current_app.config.get("MOCK_VIC_DECLINE"):
            return AuthorizationResult(
                approved=False,
                authorization_ref=None,
                amount=instruction.amount,
                currency=instruction.currency,
                reason="mock_authorization_declined",
            )
        reference = uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"{token_ref}:{instruction.idempotency_key}",
        )
        return AuthorizationResult(
            approved=True,
            authorization_ref=f"VIC-MOCK-{str(reference).upper()}",
            amount=instruction.amount,
            currency=instruction.currency,
        )

    def void(self, *, token_ref: str, authorization_ref: str) -> dict:
        return {"voided": True, "authorization_ref": authorization_ref}


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


def authorization_reference(*, payment_id: str, instruction_id: str) -> str:
    return f"payment:{payment_id}|instruction:{instruction_id}"


def parse_authorization_reference(authorization_ref: str) -> tuple[str | None, str | None]:
    payment_id = None
    instruction_id = None
    for part in str(authorization_ref or "").split("|"):
        if part.startswith("payment:"):
            payment_id = part.removeprefix("payment:") or None
        elif part.startswith("instruction:"):
            instruction_id = part.removeprefix("instruction:") or None
    return payment_id, instruction_id


class VisaAcceptanceError(RuntimeError):
    def __init__(self, reason: str, authorization_ref: str | None = None):
        self.reason = reason
        self.authorization_ref = authorization_ref
        message = reason
        if authorization_ref:
            message = f"{reason}; authorization_void_pending:{authorization_ref}"
        super().__init__(message)


class VisaAcceptanceProvider(PaymentProvider):
    """Sandbox Visa Acceptance purchase intent, credential retrieval, and auth-only hold."""

    def __init__(self, transport=None):
        self._transport = transport

    def authorize(self, *, token_ref: str, instruction: UserInstruction) -> AuthorizationResult:
        if instruction.amount > instruction.max_price:
            return _declined(instruction, "amount_exceeds_user_instruction")
        missing = _missing_visa_config()
        if missing:
            return _declined(instruction, f"visa_acceptance_not_configured:{','.join(missing)}")
        if not str(token_ref or "").strip():
            return _declined(instruction, "missing_instrument_identifier")

        instruction_id = None
        payment_id = None
        try:
            created = self._request(
                "POST",
                "/acp/v1/instructions",
                _purchase_intent_body(token_ref, instruction),
            )
            instruction_id = str(created.get("instructionId") or "") or None
            if not instruction_id:
                return _declined(instruction, "purchase_intent_missing_instruction_id")
            credentials = self._request(
                "POST",
                f"/acp/v1/instructions/{quote(instruction_id, safe='')}/credentials",
                _credentials_body(token_ref, instruction),
            )
            status = str(credentials.get("status") or "COMPLETED")
            if status not in {"COMPLETED", "SUCCESS"}:
                raise VisaAcceptanceError(f"payment_credentials_{status.casefold()}")
            card = _card_from_credentials(credentials)
            if card is None:
                raise VisaAcceptanceError("payment_credentials_missing")
            payment = self._request("POST", "/pts/v2/payments", _auth_body(instruction, card))
            payment_id = str(payment.get("id") or "") or None
            payment_status = str(payment.get("status") or "")
            if payment_status not in AUTHORIZED_STATUSES or not payment_id:
                raise VisaAcceptanceError(f"payment_{payment_status.casefold() or 'declined'}")
            return AuthorizationResult(
                approved=True,
                authorization_ref=authorization_reference(payment_id=payment_id, instruction_id=instruction_id),
                amount=instruction.amount,
                currency=instruction.currency,
            )
        except VisaAcceptanceError as exc:
            if not instruction_id and not payment_id:
                return _declined(instruction, exc.reason)
            reference = authorization_reference(payment_id=payment_id or "", instruction_id=instruction_id or "")
            try:
                self._release(payment_id, instruction_id)
            except VisaAcceptanceError as release_error:
                raise VisaAcceptanceError(release_error.reason, reference) from exc
            return _declined(instruction, exc.reason)

    def void(self, *, token_ref: str, authorization_ref: str) -> dict:
        payment_id, instruction_id = parse_authorization_reference(authorization_ref)
        if not payment_id and not instruction_id:
            return {"voided": False, "authorization_ref": authorization_ref}
        self._release(payment_id, instruction_id)
        return {"voided": True, "authorization_ref": authorization_ref}

    def _release(self, payment_id: str | None, instruction_id: str | None) -> None:
        if payment_id:
            reversal = self._request(
                "POST",
                f"/pts/v2/payments/{quote(payment_id, safe='')}/reversals",
                {"clientReferenceInformation": {"code": _correlation(f"void:{payment_id}")[:25]}},
            )
            status = str(reversal.get("status") or "")
            if status not in {"REVERSED", "VOIDED"}:
                raise VisaAcceptanceError(f"reversal_{status.casefold() or 'failed'}")
        if instruction_id:
            self._request(
                "PUT",
                f"/acp/v1/instructions/{quote(instruction_id, safe='')}",
                _cancel_intent_body(instruction_id),
            )

    def _request(self, method: str, path: str, payload: dict) -> dict:
        if self._transport is not None:
            body = self._transport(method, path, payload)
            if not isinstance(body, dict):
                raise VisaAcceptanceError("visa_acceptance_invalid_response")
            return body
        config = current_app.config
        host = str(config["VISA_ACCEPTANCE_HOST"]).strip()
        raw = json.dumps(payload, separators=(",", ":")).encode()
        date = formatdate(timeval=None, localtime=False, usegmt=True)
        headers = http_signature_headers(
            method=method,
            host=host,
            path=path,
            body=raw,
            merchant_id=str(config["VISA_ACCEPTANCE_MERCHANT_ID"]).strip(),
            key_id=str(config["VISA_ACCEPTANCE_KEY_ID"]).strip(),
            shared_secret=str(config["VISA_ACCEPTANCE_SHARED_SECRET"]).strip(),
            date=date,
        )
        try:
            response = requests.request(
                method,
                f"https://{host}{path}",
                data=raw,
                headers=headers,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise VisaAcceptanceError("visa_acceptance_unreachable") from exc
        if response.status_code >= 400:
            raise VisaAcceptanceError(_error_reason(response))
        try:
            body = response.json()
        except ValueError as exc:
            raise VisaAcceptanceError("visa_acceptance_invalid_response") from exc
        if not isinstance(body, dict):
            raise VisaAcceptanceError("visa_acceptance_invalid_response")
        return body


def get_payment_provider() -> PaymentProvider:
    name = str(current_app.config.get("PAYMENT_PROVIDER", "mock_vic")).casefold()
    if name == "mock_vic":
        return MockVisaIntelligentCommerceProvider()
    if name == "visa_acceptance":
        return VisaAcceptanceProvider()
    raise RuntimeError(f"Unsupported payment provider: {name}")


def _declined(instruction: UserInstruction, reason: str) -> AuthorizationResult:
    return AuthorizationResult(
        approved=False,
        authorization_ref=None,
        amount=instruction.amount,
        currency=instruction.currency,
        reason=reason,
    )


def _missing_visa_config() -> list[str]:
    required = (
        "VISA_ACCEPTANCE_MERCHANT_ID",
        "VISA_ACCEPTANCE_KEY_ID",
        "VISA_ACCEPTANCE_SHARED_SECRET",
        "VISA_ACCEPTANCE_HOST",
        "VISA_ACCEPTANCE_TOKENIZED_CARD",
    )
    return [name for name in required if not str(current_app.config.get(name) or "").strip()]


def _correlation(value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, value))


def _purchase_intent_body(token_ref: str, instruction: UserInstruction) -> dict:
    correlation = _correlation(instruction.idempotency_key)
    until = datetime.now(timezone.utc) + timedelta(days=1)
    return {
        "clientCorrelationId": correlation,
        "paymentInformation": {
            "customer": {"id": ""},
            "paymentInstrument": {"id": ""},
            "instrumentIdentifier": {"id": token_ref},
        },
        "deviceInformation": _device_information(correlation),
        "tokenizedCard": {"number": str(current_app.config["VISA_ACCEPTANCE_TOKENIZED_CARD"]).strip()},
        "assuranceData": [_assurance_data(correlation)],
        "mandates": [
            {
                "mandateId": correlation,
                "declineThreshold": {
                    "amount": f"{instruction.max_price:.2f}",
                    "currencyCode": instruction.currency,
                },
                "effectiveUntilTime": str(int(until.timestamp())),
                "description": instruction.item[:255],
            }
        ],
        "consumerPrompt": f"Authorize {instruction.currency} {instruction.amount:.2f} for {instruction.item}"[:255],
    }


def _credentials_body(token_ref: str, instruction: UserInstruction) -> dict:
    correlation = _correlation(f"credentials:{instruction.idempotency_key}")
    merchant_url = str(current_app.config.get("PUBLIC_APP_URL") or "https://example.com")
    return {
        "clientCorrelationId": correlation,
        "paymentInformation": {"instrumentIdentifier": {"id": token_ref}},
        "tokenizedCard": {"number": str(current_app.config["VISA_ACCEPTANCE_TOKENIZED_CARD"]).strip()},
        "transactionData": [
            {
                "clientReferenceInformation": {"code": correlation.replace("-", "")[:25]},
                "transactionType": "PURCHASE",
                "orderInformation": {
                    "amountDetail": {
                        "totalAmount": f"{instruction.amount:.2f}",
                        "currency": instruction.currency,
                    }
                },
                "merchantInformation": {
                    "merchantName": "Campfire",
                    "merchantDescriptor": {"country": "US", "url": merchant_url},
                },
                "products": [
                    {
                        "productName": instruction.item[:255],
                        "quantity": "1",
                        "unitPrice": {"currency": instruction.currency, "amount": f"{instruction.amount:.2f}"},
                    }
                ],
            }
        ],
    }


def _auth_body(instruction: UserInstruction, card: dict) -> dict:
    tokenized = {
        "number": card["number"],
        "expirationMonth": card["expirationMonth"],
        "expirationYear": card["expirationYear"],
    }
    if card.get("cryptogram"):
        tokenized["cryptogram"] = card["cryptogram"]
        tokenized["transactionType"] = "1"
    return {
        "clientReferenceInformation": {"code": _correlation(instruction.idempotency_key).replace("-", "")[:25]},
        "processingInformation": {"capture": False, "commerceIndicator": "internet"},
        "paymentInformation": {"tokenizedCard": tokenized},
        "orderInformation": {
            "amountDetails": {
                "totalAmount": f"{instruction.amount:.2f}",
                "currency": instruction.currency,
            },
            "billTo": {
                "firstName": "Campfire",
                "lastName": "Traveler",
                "address1": "1 Market St",
                "locality": "San Francisco",
                "administrativeArea": "CA",
                "postalCode": "94105",
                "country": "US",
                "email": "traveler@example.com",
            },
        },
    }


def _cancel_intent_body(instruction_id: str) -> dict:
    correlation = _correlation(f"cancel:{instruction_id}")
    return {
        "clientCorrelationId": correlation,
        "deviceInformation": _device_information(correlation),
        "assuranceData": [_assurance_data(correlation)],
    }


def _device_information(correlation: str) -> dict:
    return {
        "applicationName": "Campfire",
        "fingerprintSessionId": correlation,
        "deviceData": {"type": "Mobile", "brand": "Campfire"},
        "ipAddress": "127.0.0.1",
    }


def _assurance_data(correlation: str) -> dict:
    return {
        "verificationType": "DEVICE",
        "verificationMethod": "02",
        "verificationResults": "01",
        "verificationTimestamp": str(int(datetime.now(timezone.utc).timestamp())),
        "authenticatedIdentities": {"id": correlation, "provider": "VISA_PAYMENT_PASSKEY"},
    }


def _card_from_credentials(payload: dict) -> dict | None:
    found = []
    tokenized = payload.get("tokenizedCard")
    if isinstance(tokenized, dict):
        found.append(tokenized)
    payment = payload.get("paymentInformation") or {}
    if isinstance(payment, dict):
        if isinstance(payment.get("tokenizedCard"), dict):
            found.append(payment["tokenizedCard"])
        if isinstance(payment.get("card"), dict):
            found.append(payment["card"])
    for item in payload.get("paymentCredentials") or []:
        if isinstance(item, dict):
            found.append(item.get("tokenizedCard") or item)
    for card in found:
        number = str(card.get("number") or "")
        month = str(card.get("expirationMonth") or card.get("expiryMonth") or "")
        year = str(card.get("expirationYear") or card.get("expiryYear") or "")
        if number and month and year:
            cryptogram = card.get("cryptogram") or card.get("dynamicData") or ""
            return {
                "number": number,
                "expirationMonth": month,
                "expirationYear": year,
                "cryptogram": str(cryptogram or ""),
            }
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
