import json
import unittest
import sys
import types
from datetime import date
from pathlib import Path

from flask import Flask

backboard = types.ModuleType("backboard")
backboard.BackboardClient = object
sys.modules.setdefault("backboard", backboard)

from app.models import Booking
from app.services.activities import (
    MockActivityProvider,
    ViatorActivityProvider,
    _DESTINATIONS,
    build_viator_candidates,
    make_book_ref,
    price_from_schedule,
)
from app.services.bookings import _compact_summary, _match_items, _normalize
from app.services.payments import (
    MockVICProvider,
    NotConfiguredError,
    PaymentDeclinedError,
    RealVICProvider,
    get_payment_provider,
    http_signature_headers,
    signature_for_signing_string,
)

VIATOR_FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "viator_sandbox.json").read_text(encoding="utf-8")
)
VISA_BASELINE_SECRET = "0123k20MBbIB2t012345678993gHCIZsQKFpf7dR0hY="
VISA_BASELINE_DIGEST = "SHA-256=a/goIo1XUCr80rnKFCWp7yRpwVL50E9RaunuEHh11XM="
VISA_BASELINE_SIGNATURE = "ViHPF/tRP+jlFkWaUWBB53WQ6ASQ1ox1zbJ7ApVc7Q8="


class BookingServiceTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            MOCK_ACTIVITY_REPRICE_DELTA=0,
            MOCK_VIC_DECLINE=False,
            MOCK_VIC_ENROLL_DELAY_SECONDS=0,
            PAYMENT_PROVIDER="mock_vic",
        )
        self.context = self.app.app_context()
        self.context.push()

    def tearDown(self):
        self.context.pop()

    def test_mock_search_returns_ranked_candidates_per_slot(self):
        rows = MockActivityProvider().search(
            day=date(2026, 9, 27),
            location={"name": "Lisbon"},
            preferences=["vegetarian outdoors"],
            suggestion_text="Try something local",
        )
        self.assertEqual({"morning", "afternoon", "evening"}, {row["time_slot"] for row in rows})
        self.assertTrue(all(2 <= sum(item["time_slot"] == slot for item in rows) <= 3 for slot in {
            "morning", "afternoon", "evening"
        }))
        self.assertTrue(all(row["location"] == "Lisbon" for row in rows))

    def test_item_matching_is_fail_closed_on_ambiguous_type(self):
        rows = [
            Booking(item_type="activity", candidate_json={"name": "Old Town walking tour"}),
            Booking(item_type="activity", candidate_json={"name": "Harbor kayak rental"}),
        ]
        self.assertEqual([], _match_items(rows, "dinner"))
        self.assertEqual(2, len(_match_items(rows, "activity")))
        self.assertEqual("old town walking tour", _normalize(" Old Town walking tour!!! "))

    def test_mock_payment_follows_vic_contract_and_decline_switch(self):
        provider = MockVICProvider()
        billing = {
            "firstName": "Priya",
            "lastName": "Shah",
            "email": "priya.shah@example.com",
            "country": "US",
            "countryCallingCode": "1",
            "phoneNumber": "5550100001",
            "paymentInformation": {"instrumentIdentifier": {"id": "vic-demo-priya"}},
        }
        device = {"applicationName": "Campfire", "ipAddress": "127.0.0.1", "deviceData": {"type": "Mobile", "brand": "Campfire"}}
        purchase = {
            "amount": "22.00",
            "max_price": "22.00",
            "currency": "USD",
            "item": "Tour",
            "merchantName": "Campfire",
            "merchantUrl": "http://localhost:5173",
        }
        enrolled = provider.enroll_card("priya", billing, device)
        self.assertEqual(enrolled.status, "ACTIVE")
        self.assertEqual(enrolled.instrument_id, "vic-demo-priya")
        self.assertEqual(
            enrolled.to_dict(),
            {"clientCorrelationId": enrolled.client_correlation_id, "status": "ACTIVE"},
        )
        intent = provider.initiate_purchase_intent(enrolled.instrument_id, purchase)
        self.assertEqual(intent.status, "ACTIVE")
        self.assertIn("instructionId", intent.to_dict())
        credentials = provider.retrieve_payment_credentials(intent.instruction_id)
        self.assertEqual(len(credentials.token_ref), 32)
        self.assertTrue(all(char in "0123456789abcdef" for char in credentials.token_ref))
        self.assertFalse(credentials.token_ref.isdigit())
        self.assertEqual(credentials.masked_card_info["suffix"], "1881")
        self.assertEqual(credentials.to_dict()["tokenizedCard"]["number"], credentials.token_ref)
        self.assertEqual(credentials.to_dict()["status"], "COMPLETED")
        confirmed = provider.confirm_transaction(intent.instruction_id, {"type": "PURCHASE", "totalAmount": "22.00", "currency": "USD"})
        self.assertEqual(confirmed.status, "COMPLETED")
        self.assertEqual(confirmed.to_dict()["status"], "COMPLETED")
        self.assertEqual(confirmed.to_dict()["signedPayload"], "jws-signed-payload")

        over_limit = dict(purchase, amount="30.00", max_price="22.00")
        with self.assertRaises(PaymentDeclinedError) as limit_error:
            provider.initiate_purchase_intent(enrolled.instrument_id, over_limit)
        self.assertEqual(limit_error.exception.reason, "amount_exceeds_user_instruction")

        self.app.config["MOCK_VIC_DECLINE"] = True
        with self.assertRaises(PaymentDeclinedError) as decline_error:
            provider.initiate_purchase_intent(enrolled.instrument_id, purchase)
        self.assertEqual(decline_error.exception.reason, "mock_authorization_declined")

        self.app.config["MOCK_VIC_DECLINE"] = False
        self.app.config["MOCK_VIC_ENROLL_DELAY_SECONDS"] = 60
        pending_provider = MockVICProvider()
        pending = pending_provider.enroll_card("priya", billing, device)
        self.assertEqual(pending.status, "PENDING")
        self.assertEqual(pending.to_dict()["pendingEvents"], ["PENDING_CARDHOLDER_AUTHENTICATION"])
        self.assertIsInstance(get_payment_provider(), MockVICProvider)

    def test_approval_summary_is_derived_from_provider_terms(self):
        summary = _compact_summary(
            [
                {
                    "name": "Old Town walking tour",
                    "price": 22,
                    "currency": "USD",
                    "start_time": "10:00",
                    "time_slot": "morning",
                }
            ]
        )
        self.assertIn("morning plan: Old Town walking tour ($22.00, 10:00)", summary)
        self.assertIn("Reply “approve” to book every listed plan item", summary)

    def test_visa_signature_matches_documented_baseline(self):
        headers = http_signature_headers(
            method="POST",
            host="apitest.visaacceptance.com",
            path="/pts/v2/payments/",
            body=b'{"hello":"world"}',
            merchant_id="testmid",
            key_id="01234567-0123-0123-0123-012345678912",
            shared_secret=VISA_BASELINE_SECRET,
            date="Fri, 14 Dec 2018 00:00:00 GMT",
        )
        self.assertEqual(headers["Host"], "apitest.visaacceptance.com")
        self.assertEqual(headers["v-c-merchant-id"], "testmid")
        self.assertEqual(headers["Digest"], "SHA-256=k6I5cakU5erL8KjSUVTNownDwccvu5kU1Hxg88toFYg=")
        signed_body = "\n".join(
            [
                "host: apitest.visaacceptance.com",
                "date: Fri, 14 Dec 2018 00:00:00 GMT",
                "(request-target): post /pts/v2/payments/",
                f"digest: {headers['Digest']}",
                "v-c-merchant-id: testmid",
            ]
        )
        self.assertIn(
            f'signature="{signature_for_signing_string(signed_body, VISA_BASELINE_SECRET)}"',
            headers["Signature"],
        )
        self.assertIn(
            'keyid="01234567-0123-0123-0123-012345678912", algorithm="HmacSHA256", '
            'headers="host date (request-target) digest v-c-merchant-id"',
            headers["Signature"],
        )
        published = "\n".join(
            [
                "host: apitest.visaacceptance.com",
                "date: Fri, 14 Dec 2018 00:00:00 GMT",
                "(request-target): post /pts/v2/payments/",
                f"digest: {VISA_BASELINE_DIGEST}",
                "v-c-merchant-id: testmid",
            ]
        )
        self.assertEqual(
            signature_for_signing_string(published, VISA_BASELINE_SECRET),
            VISA_BASELINE_SIGNATURE,
        )

    def test_real_vic_requires_credentials_and_follows_four_endpoints(self):
        with self.assertRaises(NotConfiguredError) as missing:
            RealVICProvider()
        self.assertEqual(
            missing.exception.missing,
            ["ORG_ID", "API_KEY", "SHARED_SECRET", "TOKEN_REQUESTER_ID", "RELATIONSHIP_ID"],
        )
        calls = []

        def transport(method, path, payload):
            calls.append((method, path, payload))
            if path == "/acp/v1/tokens":
                self.assertEqual(payload["paymentInformation"]["instrumentIdentifier"]["id"], "7019989999909760770")
                self.assertIn("billTo", payload)
                self.assertIn("buyerInformation", payload)
                self.assertIn("consumerIdentity", payload)
                self.assertIn("deviceInformation", payload)
                return {"clientCorrelationId": payload["clientCorrelationId"], "status": "ACTIVE"}
            if path == "/acp/v1/instructions" and method == "POST":
                self.assertEqual(payload["paymentInformation"]["instrumentIdentifier"]["id"], "7019989999909760770")
                self.assertEqual(payload["tokenizedCard"]["number"], "7019989999909760770")
                self.assertIn("mandates", payload)
                return {"clientCorrelationId": payload["clientCorrelationId"], "instructionId": "ins-1"}
            if path.endswith("/credentials"):
                self.assertEqual(payload["paymentInformation"]["instrumentIdentifier"]["id"], "7019989999909760770")
                self.assertEqual(payload["transactionData"][0]["orderInformation"]["amountDetail"]["totalAmount"], "22.00")
                return {
                    "clientCorrelationId": payload["clientCorrelationId"],
                    "transactionId": "txn-1",
                    "status": "COMPLETED",
                    "tokenizedCard": {
                        "number": "15602cf86c70b8b63297134292ec5801",
                        "expirationMonth": "12",
                        "expirationYear": "2031",
                        "type": "001",
                    },
                }
            if path.endswith("/confirmations"):
                self.assertEqual(payload["transactionData"][0]["orderInformation"]["amountDetail"]["currency"], "USD")
                return {
                    "clientCorrelationId": payload["clientCorrelationId"],
                    "transactionId": "txn-1",
                    "status": "COMPLETED",
                    "signedPayload": "jws-signed-payload",
                }
            raise AssertionError(path)

        self.app.config.update(
            VIC_ORG_ID="testmid",
            VIC_API_KEY="key",
            VIC_SHARED_SECRET=VISA_BASELINE_SECRET,
            VIC_TOKEN_REQUESTER_ID="requester",
            VIC_RELATIONSHIP_ID="relationship",
            PAYMENT_PROVIDER="real_vic",
            PUBLIC_APP_URL="http://localhost:5173",
        )
        self.assertIsInstance(get_payment_provider(), RealVICProvider)
        provider = RealVICProvider(transport=transport)
        billing = {
            "firstName": "Priya",
            "lastName": "Shah",
            "email": "priya.shah@example.com",
            "country": "US",
            "countryCallingCode": "1",
            "phoneNumber": "5550100001",
            "paymentInformation": {"instrumentIdentifier": {"id": "7019989999909760770"}},
        }
        enrolled = provider.enroll_card("priya", billing, {"applicationName": "Campfire"})
        self.assertEqual(enrolled.status, "ACTIVE")
        purchase = {
            "amount": "22.00",
            "max_price": "22.00",
            "currency": "USD",
            "item": "Alfama walking tour",
            "tokenized_card_number": "7019989999909760770",
            "merchantName": "Campfire",
            "merchantUrl": "http://localhost:5173",
        }
        intent = provider.initiate_purchase_intent(enrolled.instrument_id, purchase)
        credentials = provider.retrieve_payment_credentials(intent.instruction_id)
        self.assertEqual(credentials.token_ref, "15602cf86c70b8b63297134292ec5801")
        confirmed = provider.confirm_transaction(
            intent.instruction_id,
            {"type": "PURCHASE", "totalAmount": "22.00", "currency": "USD", "merchantName": "Campfire", "merchantUrl": "http://localhost:5173"},
        )
        self.assertEqual(confirmed.status, "COMPLETED")
        self.assertEqual(
            [path for _method, path, _payload in calls],
            [
                "/acp/v1/tokens",
                "/acp/v1/instructions",
                "/acp/v1/instructions/ins-1/credentials",
                "/acp/v1/instructions/ins-1/confirmations",
            ],
        )

    def test_viator_search_and_quote_map_sandbox_fixture(self):
        day = date(2026, 9, 27)
        schedules = VIATOR_FIXTURE["schedules"]
        candidates = build_viator_candidates(
            day=day,
            location_name="Lisbon",
            products=VIATOR_FIXTURE["search"]["products"],
            schedules=schedules,
            rates={"EUR": 1.1},
            preferences=["walking"],
            suggestion_text="local",
        )
        by_code = {item["book_ref"].split("|")[1]: item for item in candidates}
        self.assertEqual(by_code["1001P1"]["time_slot"], "morning")
        self.assertEqual(by_code["1001P1"]["price"], 22.0)
        self.assertEqual(by_code["1001P1"]["currency"], "USD")
        self.assertEqual(by_code["1001P1"]["start_time"], "10:00")
        self.assertEqual(
            by_code["1001P1"]["book_ref"],
            make_book_ref("1001P1", "TG1", "2026-09-27", "10:00"),
        )
        self.assertEqual(by_code["1002P2"]["time_slot"], "afternoon")
        self.assertEqual(by_code["1002P2"]["price"], 44.0)
        morning = price_from_schedule(
            schedules["1001P1"],
            {"product_code": "1001P1", "option_code": "TG1", "travel_date": "2026-09-27", "start_time": "10:00"},
            {},
        )
        self.assertEqual(morning, 22.0)
        _DESTINATIONS.clear()
        calls = []

        def transport(method, path, payload):
            calls.append(path)
            if path == "/destinations":
                return VIATOR_FIXTURE["destinations"]
            if path == "/products/search":
                self.assertEqual(payload["filtering"]["destination"], "538")
                self.assertEqual(payload["currency"], "USD")
                return VIATOR_FIXTURE["search"]
            if path.startswith("/availability/schedules/"):
                return schedules[path.rsplit("/", 1)[-1]]
            if path == "/exchange-rates":
                return VIATOR_FIXTURE["rates"]
            raise AssertionError(path)

        rows = ViatorActivityProvider(transport=transport).search(
            day=day,
            location={"name": "Lisbon"},
            preferences=[],
            suggestion_text="",
        )
        self.assertEqual({row["book_ref"] for row in rows}, {item["book_ref"] for item in candidates})
        self.assertIn("/products/search", calls)


if __name__ == "__main__":
    unittest.main()
