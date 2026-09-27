"""Pluggable activity search and booking providers."""

import json
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import requests
from flask import current_app

logger = logging.getLogger(__name__)

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
    if name == "viator":
        return ViatorActivityProvider()
    raise RuntimeError(f"Unsupported activity provider: {name}")


_DESTINATIONS: dict[str, list] = {}
_WEEKDAYS = ("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY")


class ViatorActivityProvider(ActivityProvider):
    """Viator Partner API sandbox search, quote, and cart booking."""

    def __init__(self, transport=None):
        self._transport = transport

    def search(self, *, day, location, preferences, suggestion_text) -> list[dict]:
        location_name = str((location or {}).get("name") or "").strip()
        if not location_name:
            return []
        destination = self._destination(location_name)
        if destination is None:
            payload = self._request(
                "POST",
                "/search/freetext",
                {
                    "searchTerm": location_name,
                    "currency": "USD",
                    "searchTypes": [{"searchType": "PRODUCTS", "pagination": {"start": 1, "count": 20}}],
                },
            )
        else:
            payload = self._request(
                "POST",
                "/products/search",
                {
                    "filtering": {
                        "destination": str(destination),
                        "startDate": day.isoformat(),
                        "endDate": day.isoformat(),
                    },
                    "sorting": {"sort": "TRAVELER_RATING", "order": "DESCENDING"},
                    "pagination": {"start": 1, "count": 20},
                    "currency": "USD",
                },
            )
        ranked = _rank_products(_product_list(payload), preferences, suggestion_text)[:9]
        schedules = {}
        currencies = set()
        for product in ranked:
            code = str(product.get("productCode") or "")
            if not code:
                continue
            try:
                schedule = self._request("GET", f"/availability/schedules/{code}", None)
            except RuntimeError:
                logger.info("Skipping Viator product %s because its schedule was unavailable", code)
                continue
            schedules[code] = schedule
            currency = str(schedule.get("currency") or "USD").upper()
            if currency != "USD":
                currencies.add(currency)
        rates = self._usd_rates(currencies)
        return build_viator_candidates(
            day=day,
            location_name=location_name,
            products=ranked,
            schedules=schedules,
            rates=rates,
            preferences=preferences,
            suggestion_text=suggestion_text,
        )

    def quote(self, book_ref: str) -> BookingQuote:
        parsed = parse_book_ref(book_ref)
        schedule = self._request("GET", f"/availability/schedules/{parsed['product_code']}", None)
        currency = str(schedule.get("currency") or "USD").upper()
        rates = self._usd_rates(set() if currency == "USD" else {currency})
        price = price_from_schedule(schedule, parsed, rates)
        return BookingQuote(book_ref=book_ref, price=price, currency="USD")

    def confirm(self, book_ref: str, *, authorization_ref: str, idempotency_key: str) -> BookingConfirmation:
        parsed = parse_book_ref(book_ref)
        booker = _booker()
        partner_ref = idempotency_key[:100]
        item = _cart_item(parsed, partner_ref)
        held = self._request(
            "POST",
            "/bookings/cart/hold",
            {"currency": "USD", "partnerCartRef": partner_ref, "items": [item]},
        )
        held_item = (held.get("items") or [{}])[0]
        booking_ref = str(held_item.get("bookingRef") or "")
        cart_ref = str(held.get("cartRef") or "")
        if not booking_ref or not cart_ref or str(held_item.get("status") or "") not in {"", "BOOKABLE"}:
            raise RuntimeError("Viator hold did not return a bookable cart")
        booked_item = {"bookingRef": booking_ref, **item}
        booked = self._request(
            "POST",
            "/bookings/cart/book",
            {
                "cartRef": cart_ref,
                "bookerInfo": {"firstName": booker["first_name"], "lastName": booker["last_name"]},
                "communication": {"email": booker["email"], "phone": booker["phone"]},
                "items": [booked_item],
            },
        )
        confirmed = (booked.get("items") or [{}])[0]
        status = str(confirmed.get("status") or "")
        confirmation_ref = str(confirmed.get("bookingRef") or booking_ref)
        if status not in {"CONFIRMED", "PENDING"}:
            raise RuntimeError(f"Viator booking {status or 'failed'}")
        return BookingConfirmation(
            confirmation_ref=confirmation_ref,
            details=f"Viator {status} cart {cart_ref}. Payment authorization {authorization_ref}.",
        )

    def _destination(self, location_name: str) -> str | None:
        base = _viator_base_url()
        if base not in _DESTINATIONS:
            payload = self._request("GET", "/destinations", None)
            _DESTINATIONS[base] = list(payload.get("destinations") or [])
        needle = location_name.casefold()
        matches = [
            row
            for row in _DESTINATIONS[base]
            if str(row.get("name") or "").casefold() == needle and row.get("destinationId") is not None
        ]
        if not matches:
            return None
        rank = {"CITY": 0, "REGION": 1, "COUNTRY": 2}
        matches.sort(key=lambda row: rank.get(str(row.get("type") or "").upper(), 9))
        return str(matches[0]["destinationId"])

    def _usd_rates(self, currencies: set[str]) -> dict[str, float]:
        if not currencies:
            return {}
        payload = self._request(
            "POST",
            "/exchange-rates",
            {"sourceCurrencies": sorted(currencies), "targetCurrencies": ["USD"]},
        )
        rates = {}
        for row in payload.get("rates") or []:
            if str(row.get("targetCurrency") or "").upper() == "USD" and row.get("rate") is not None:
                rates[str(row.get("sourceCurrency") or "").upper()] = float(row["rate"])
        return rates

    def _request(self, method: str, path: str, payload: dict | None) -> dict:
        if self._transport is not None:
            body = self._transport(method, path, payload)
            if not isinstance(body, dict):
                raise RuntimeError(f"Viator {method} {path} returned an invalid response")
            return body
        key = str(current_app.config.get("VIATOR_API_KEY") or "").strip()
        if not key:
            raise RuntimeError("Viator API key is not configured")
        headers = {
            "exp-api-key": key,
            "Accept": "application/json;version=2.0",
            "Accept-Language": "en-US",
        }
        kwargs = {"headers": headers, "timeout": 120 if path.endswith("/book") else 30}
        if payload is not None:
            headers["Content-Type"] = "application/json"
            kwargs["json"] = payload
        try:
            response = requests.request(method, f"{_viator_base_url()}{path}", **kwargs)
        except requests.RequestException as exc:
            raise RuntimeError(f"Viator {method} {path} was unreachable") from exc
        if response.status_code >= 400:
            logger.info("Viator HTTP %s for %s %s", response.status_code, method, path)
            raise RuntimeError(f"Viator {method} {path} failed with HTTP {response.status_code}")
        try:
            body = response.json()
        except ValueError as exc:
            raise RuntimeError(f"Viator {method} {path} returned invalid JSON") from exc
        if not isinstance(body, dict):
            raise RuntimeError(f"Viator {method} {path} returned an invalid response")
        return body


def build_viator_candidates(
    *,
    day: date,
    location_name: str,
    products: list[dict],
    schedules: dict,
    rates: dict[str, float],
    preferences: list[str],
    suggestion_text: str,
) -> list[dict]:
    ranked = _rank_products(products, preferences, suggestion_text)
    found = []
    for product in ranked:
        code = str(product.get("productCode") or "")
        schedule = schedules.get(code)
        if not schedule:
            continue
        option = _first_bookable(schedule, day)
        if option is None:
            continue
        try:
            price = _usd(option["price"], option["currency"], rates)
        except ValueError:
            continue
        found.append(
            {
                "name": str(product.get("title") or product.get("name") or code),
                "item_type": "activity",
                "price": price,
                "currency": "USD",
                "rating": round(float((product.get("reviews") or {}).get("combinedAverageRating") or 0), 1),
                "time_slot": slot_for_start_time(option["start_time"]),
                "start_time": option["start_time"],
                "book_ref": make_book_ref(code, option["option_code"], day.isoformat(), option["start_time"]),
                "tags": [str(flag).casefold() for flag in product.get("flags") or []],
                "date": day.isoformat(),
                "location": location_name,
            }
        )
    result = []
    for slot in SLOTS:
        result.extend([item for item in found if item["time_slot"] == slot][:3])
    return result


def price_from_schedule(schedule: dict, parsed: dict, rates: dict[str, float]) -> float:
    currency = str(schedule.get("currency") or "USD").upper()
    day = date.fromisoformat(parsed["travel_date"])
    for item in schedule.get("bookableItems") or []:
        option_code = str(item.get("productOptionCode") or "-")
        if option_code != parsed["option_code"]:
            continue
        for season in item.get("seasons") or []:
            if not _season_covers(season, day):
                continue
            for record in season.get("pricingRecords") or []:
                if not _record_covers(record, day, parsed["start_time"]):
                    continue
                amount = _adult_price(record)
                if amount is None:
                    continue
                return _usd(amount, currency, rates)
    raise ValueError(f"No USD price for activity book_ref on {parsed['travel_date']}")


def make_book_ref(product_code: str, option_code: str, travel_date: str, start_time: str) -> str:
    return "|".join(["viator", product_code, option_code or "-", travel_date, start_time or "-"])


def parse_book_ref(book_ref: str) -> dict:
    parts = str(book_ref or "").split("|")
    if len(parts) != 5 or parts[0] != "viator" or not parts[1] or not parts[3]:
        raise ValueError(f"Unknown activity book_ref: {book_ref}")
    return {
        "product_code": parts[1],
        "option_code": parts[2] or "-",
        "travel_date": parts[3],
        "start_time": parts[4] or "-",
    }


def slot_for_start_time(start_time: str) -> str:
    if start_time in {"", "-"}:
        return "morning"
    hour = int(str(start_time).split(":", 1)[0])
    if hour < 12:
        return "morning"
    if hour < 17:
        return "afternoon"
    return "evening"


def _rank_products(products: list[dict], preferences: list[str], suggestion_text: str) -> list[dict]:
    preference_words = {word.casefold() for item in preferences for word in str(item).split()}
    hint_words = set(str(suggestion_text).casefold().split())
    ranked = []
    for product in products:
        if not isinstance(product, dict) or not product.get("productCode"):
            continue
        pricing = product.get("pricing") or {}
        if str(pricing.get("currency") or "USD").upper() != "USD":
            continue
        if (pricing.get("summary") or {}).get("fromPrice") is None:
            continue
        title = str(product.get("title") or product.get("name") or "")
        words = set(title.casefold().split()) | {str(flag).casefold() for flag in product.get("flags") or []}
        score = float((product.get("reviews") or {}).get("combinedAverageRating") or 0) * 10
        score += 4 * len(words & preference_words)
        score += 2 * len(words & hint_words)
        ranked.append((score, float(pricing["summary"]["fromPrice"]), title, product))
    ranked.sort(key=lambda item: (-item[0], item[1], item[2].casefold()))
    return [item[3] for item in ranked]


def _product_list(payload: dict) -> list[dict]:
    products = payload.get("products")
    if isinstance(products, dict):
        return list(products.get("results") or products.get("products") or [])
    return list(products or [])


def _first_bookable(schedule: dict, day: date) -> dict | None:
    currency = str(schedule.get("currency") or "USD").upper()
    for item in schedule.get("bookableItems") or []:
        option_code = str(item.get("productOptionCode") or "-")
        for season in item.get("seasons") or []:
            if not _season_covers(season, day):
                continue
            for record in season.get("pricingRecords") or []:
                if not _record_covers_day(record, day):
                    continue
                amount = _adult_price(record)
                if amount is None:
                    continue
                times = [str(entry.get("startTime") or "") for entry in record.get("timedEntries") or []]
                start_time = next((value for value in times if value), "-")
                return {
                    "option_code": option_code,
                    "start_time": start_time,
                    "price": amount,
                    "currency": currency,
                }
    return None


def _season_covers(season: dict, day: date) -> bool:
    start = season.get("startDate")
    end = season.get("endDate")
    if start and day < date.fromisoformat(str(start)):
        return False
    if end and day > date.fromisoformat(str(end)):
        return False
    return True


def _record_covers_day(record: dict, day: date) -> bool:
    days = {str(value).upper() for value in record.get("daysOfWeek") or []}
    return not days or _WEEKDAYS[day.weekday()] in days


def _record_covers(record: dict, day: date, start_time: str) -> bool:
    if not _record_covers_day(record, day):
        return False
    times = [str(entry.get("startTime") or "") for entry in record.get("timedEntries") or []]
    times = [value for value in times if value]
    if start_time in {"", "-"}:
        return not times
    return start_time in times


def _adult_price(record: dict) -> float | None:
    details = record.get("pricingDetails") or []
    adults = [row for row in details if str(row.get("ageBand") or "ADULT").upper() == "ADULT"] or details
    for row in adults:
        price = row.get("price") or {}
        original = price.get("original") or price
        for key in ("recommendedRetailPrice", "partnerTotalPrice", "partnerNetPrice"):
            if original.get(key) is not None:
                return round(float(original[key]), 2)
    return None


def _usd(amount: float, currency: str, rates: dict[str, float]) -> float:
    if currency == "USD":
        return round(float(amount), 2)
    rate = rates.get(currency)
    if rate is None:
        raise ValueError(f"No USD exchange rate for {currency}")
    return round(float(amount) * float(rate), 2)


def _cart_item(parsed: dict, partner_ref: str) -> dict:
    item = {
        "partnerBookingRef": partner_ref,
        "productCode": parsed["product_code"],
        "travelDate": parsed["travel_date"],
        "paxMix": [{"ageBand": "ADULT", "numberOfTravelers": 1}],
    }
    if parsed["option_code"] not in {"", "-"}:
        item["productOptionCode"] = parsed["option_code"]
    if parsed["start_time"] not in {"", "-"}:
        item["startTime"] = parsed["start_time"]
    return item


def _booker() -> dict:
    config = current_app.config
    booker = {
        "email": str(config.get("VIATOR_BOOKER_EMAIL") or "").strip(),
        "first_name": str(config.get("VIATOR_BOOKER_FIRST_NAME") or "").strip(),
        "last_name": str(config.get("VIATOR_BOOKER_LAST_NAME") or "").strip(),
        "phone": str(config.get("VIATOR_BOOKER_PHONE") or "").strip(),
    }
    missing = [name for name, value in booker.items() if not value]
    if missing:
        raise RuntimeError(f"Viator booker is not configured: {', '.join(missing)}")
    return booker


def _viator_base_url() -> str:
    return str(current_app.config.get("VIATOR_API_BASE_URL") or "https://api.sandbox.viator.com/partner").rstrip("/")
