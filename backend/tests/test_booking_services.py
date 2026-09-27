import unittest
import sys
import types
from datetime import date

from flask import Flask

backboard = types.ModuleType("backboard")
backboard.BackboardClient = object
sys.modules.setdefault("backboard", backboard)

from app.models import Booking
from app.services.activities import MockActivityProvider
from app.services.bookings import _compact_summary, _match_items, _normalize
from app.services.payments import MockVisaIntelligentCommerceProvider, UserInstruction


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


if __name__ == "__main__":
    unittest.main()
