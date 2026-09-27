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
    MockVisaIntelligentCommerceProvider,
    UserInstruction,
    VisaAcceptanceProvider,
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
        self.app.config.update(MOCK_ACTIVITY_REPRICE_DELTA=0, MOCK_VIC_DECLINE=False)
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

    def test_mock_payment_honors_instruction_limit_and_decline_switch(self):
        provider = MockVisaIntelligentCommerceProvider()
        instruction = UserInstruction(
            idempotency_key="booking-1",
            item="Tour",
            book_ref="mock-tour",
            amount=22,
            max_price=22,
            currency="USD",
            approval_message_id="wa-1",
        )
        approved = provider.authorize(token_ref="token", instruction=instruction)
        self.assertTrue(approved.approved)
        self.app.config["MOCK_VIC_DECLINE"] = True
        self.assertFalse(provider.authorize(token_ref="token", instruction=instruction).approved)

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

    def test_visa_acceptance_authorizes_then_voids_without_network(self):
        calls = []

        def transport(method, path, payload):
            calls.append((method, path, payload))
            if path == "/acp/v1/instructions" and method == "POST":
                return {"instructionId": "ins-1"}
            if path.endswith("/credentials"):
                return {
                    "status": "COMPLETED",
                    "tokenizedCard": {
                        "number": "token-card",
                        "expirationMonth": "12",
                        "expirationYear": "2031",
                        "cryptogram": "abc",
                    },
                }
            if path == "/pts/v2/payments":
                self.assertFalse(payload["processingInformation"]["capture"])
                return {"id": "pay-1", "status": "AUTHORIZED"}
            if path.endswith("/reversals"):
                return {"status": "REVERSED"}
            if method == "PUT":
                return {"instructionId": "ins-1"}
            raise AssertionError(path)

        self.app.config.update(
            VISA_ACCEPTANCE_MERCHANT_ID="testmid",
            VISA_ACCEPTANCE_KEY_ID="key",
            VISA_ACCEPTANCE_SHARED_SECRET=VISA_BASELINE_SECRET,
            VISA_ACCEPTANCE_HOST="apitest.visaacceptance.com",
            VISA_ACCEPTANCE_TOKENIZED_CARD="enrolled-token",
            PUBLIC_APP_URL="http://localhost:5173",
        )
        provider = VisaAcceptanceProvider(transport=transport)
        instruction = UserInstruction(
            idempotency_key="booking-1",
            item="Alfama walking tour",
            book_ref="viator|1001P1|TG1|2026-09-27|10:00",
            amount=22,
            max_price=22,
            currency="USD",
            approval_message_id="wa-1",
        )
        approved = provider.authorize(token_ref="7019989999909760770", instruction=instruction)
        self.assertTrue(approved.approved)
        self.assertEqual(approved.authorization_ref, "payment:pay-1|instruction:ins-1")
        voided = provider.void(token_ref="7019989999909760770", authorization_ref=approved.authorization_ref)
        self.assertTrue(voided["voided"])
        self.assertEqual([call[0] for call in calls], ["POST", "POST", "POST", "POST", "PUT"])

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
