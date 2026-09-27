"""Pluggable activity search and booking providers."""

import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from flask import current_app

FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "activity_candidates.json"
SLOTS = ("morning", "afternoon", "evening")


@dataclass(frozen=True)
class BookingQuote:
    book_ref: str
    price: float
    currency: str


@dataclass(frozen=True)
class BookingConfirmation:
    confirmation_ref: str
    details: str


class ActivityProvider(ABC):
    @abstractmethod
    def search(
        self,
        *,
        day: date,
        location: dict,
        preferences: list[str],
        suggestion_text: str,
    ) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    def quote(self, book_ref: str) -> BookingQuote:
        raise NotImplementedError

    @abstractmethod
    def confirm(
        self,
        book_ref: str,
        *,
        authorization_ref: str,
        idempotency_key: str,
    ) -> BookingConfirmation:
        raise NotImplementedError


class MockActivityProvider(ActivityProvider):
    def __init__(self, fixture_path: Path = FIXTURE_PATH):
        self._rows = json.loads(fixture_path.read_text(encoding="utf-8"))

    def search(self, *, day, location, preferences, suggestion_text) -> list[dict]:
        location_name = str((location or {}).get("name") or "your destination")
        preference_words = {word.casefold() for item in preferences for word in str(item).split()}
        hint_words = set(str(suggestion_text).casefold().split())
        ranked = []
        for raw in self._rows:
            row = dict(raw)
            tags = {str(tag).casefold() for tag in row.get("tags") or []}
            score = float(row.get("rating") or 0) * 10
            score += 4 * len(tags & preference_words)
            score += 2 * len(tags & hint_words)
            row.update(
                {
                    "date": day.isoformat(),
                    "location": location_name,
                    "price": round(float(row["price"]), 2),
                    "rating": round(float(row["rating"]), 1),
                    "_score": score,
                }
            )
            ranked.append(row)
        ranked.sort(key=lambda item: (-item["_score"], item["price"], item["name"]))
        result = []
        for slot in SLOTS:
            slot_rows = [item for item in ranked if item["time_slot"] == slot][:3]
            for item in slot_rows:
                item.pop("_score", None)
                result.append(item)
        return result

    def quote(self, book_ref: str) -> BookingQuote:
        row = self._find(book_ref)
        delta = float(current_app.config.get("MOCK_ACTIVITY_REPRICE_DELTA", 0))
        return BookingQuote(book_ref=book_ref, price=round(float(row["price"]) + delta, 2), currency=row["currency"])

    def confirm(self, book_ref: str, *, authorization_ref: str, idempotency_key: str) -> BookingConfirmation:
        self._find(book_ref)
        suffix = str(uuid.uuid5(uuid.NAMESPACE_URL, idempotency_key))[-8:].upper()
        return BookingConfirmation(
            confirmation_ref=f"CF-{book_ref[-8:].upper()}-{suffix}",
            details="Reservation held under the approving traveler's name.",
        )

    def _find(self, book_ref: str) -> dict:
        for row in self._rows:
            if row["book_ref"] == book_ref:
                return row
        raise ValueError(f"Unknown activity book_ref: {book_ref}")


def get_activity_provider() -> ActivityProvider:
    name = str(current_app.config.get("ACTIVITY_PROVIDER", "mock")).casefold()
    if name == "mock":
        return MockActivityProvider()
    raise RuntimeError(f"Unsupported activity provider: {name}")
