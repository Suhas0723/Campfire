"""Plans the signed-in traveler can see. Payment secrets stay on the server."""

from flask import Blueprint, jsonify
from sqlalchemy.orm import selectinload

from app.auth import current_user, login_required, trips_for
from app.extensions import db
from app.models import Booking, Trip, User
from app.services.payments import DEMO_PROFILES

bp = Blueprint("bookings", __name__)

_SLOT_ORDER = {"morning": 0, "afternoon": 1, "evening": 2}
_STEP_LABELS = (
    ("card_enrolled", "Card enrolled"),
    ("purchase_intent", "Purchase intent"),
    ("payment_credentials", "Token ready"),
    ("transaction_confirmed", "Visa confirmed"),
)


def _money(value) -> str:
    return f"{float(value):.2f}"


def _payment_summary(user: User) -> dict:
    token = user.payment_token
    if token is None:
        return {"enrolled": False}
    profile = DEMO_PROFILES.get(token.token_ref) or {}
    masked = profile.get("masked") or {}
    holder = " ".join(part for part in (profile.get("first_name"), profile.get("last_name")) if part)
    return {
        "enrolled": True,
        "provider": token.provider,
        "provider_label": "Visa Intelligent Commerce",
        "mode": "demo" if token.provider == "mock_vic" else "live",
        "brand": "Visa",
        "suffix": masked.get("suffix") or "",
        "expiration_month": masked.get("expirationMonth") or "",
        "expiration_year": masked.get("expirationYear") or "",
        "spend_limit": _money(token.spend_limit),
        "currency": token.currency,
        "holder": holder or user.display_name,
    }


def _step_done(event: str, response: dict) -> bool:
    status = str(response.get("status") or "")
    if event == "purchase_intent":
        return bool(response.get("instructionId"))
    if event == "card_enrolled":
        return status == "ACTIVE"
    return status in {"COMPLETED", "SUCCESS", "ACTIVE"}


def _steps(booking: Booking) -> list[dict]:
    by_event = {}
    for log in booking.audit_logs:
        if log.event_type in dict(_STEP_LABELS):
            by_event[log.event_type] = log.provider_response or {}
    if not by_event:
        return []
    return [
        {"label": label, "done": _step_done(event, by_event.get(event) or {})}
        for event, label in _STEP_LABELS
        if event in by_event
    ]


def _confirmation_ref(booking: Booking) -> str | None:
    for log in booking.audit_logs:
        if log.event_type != "confirmed":
            continue
        ref = str((log.provider_response or {}).get("confirmation_ref") or "").strip()
        if ref:
            return ref
    return None


def _names_for(jids: set[str]) -> dict[str, str]:
    if not jids:
        return {}
    rows = db.session.query(User).filter(User.whatsapp_jid.in_(jids)).all()
    return {row.whatsapp_jid: row.display_name for row in rows}


def _booking_payload(booking: Booking, names: dict[str, str]) -> dict:
    candidate = booking.candidate_json or {}
    note = None
    price_known = candidate.get("price") is not None and candidate.get("price") != ""
    if booking.status == "suggested":
        why = str(candidate.get("why") or "").strip()
        diet = str(candidate.get("diet_fit") or "").strip()
        price_note = str(candidate.get("price_note") or "").strip()
        note = " ".join(part for part in (why, diet, price_note) if part)[:240] or None
    elif booking.status == "declined" and booking.last_error and len(booking.last_error) <= 180:
        note = booking.last_error
    return {
        "id": str(booking.id),
        "name": candidate.get("name") or "Plan",
        "item_type": booking.item_type,
        "time_slot": booking.time_slot,
        "start_time": candidate.get("start_time") or "",
        "price": float(candidate.get("price")) if price_known else None,
        "price_estimated": bool(candidate.get("price_estimated")) and price_known,
        "currency": candidate.get("currency") or "USD",
        "url": str(candidate.get("url") or ""),
        "link_label": "Reserve" if booking.item_type == "restaurant" else "Tickets",
        "status": booking.status,
        "is_primary": bool(booking.is_primary),
        "approval_deadline": booking.approval_deadline.isoformat() if booking.approval_deadline else None,
        "approved_by": names.get(booking.approved_by or "") or None,
        "confirmation_ref": _confirmation_ref(booking),
        "note": note,
        "steps": _steps(booking),
    }


def _sort_key(booking: Booking):
    return (_SLOT_ORDER.get(booking.time_slot, 9), 0 if booking.is_primary else 1, booking.created_at)


@bp.get("/bookings")
@login_required
def list_bookings():
    user = current_user()
    trips = trips_for(user).order_by(Trip.started_at.desc()).all()
    trip_ids = [trip.id for trip in trips]
    rows = (
        db.session.query(Booking).options(selectinload(Booking.audit_logs)).filter(Booking.trip_id.in_(trip_ids)).all()
        if trip_ids
        else []
    )
    names = _names_for({row.approved_by for row in rows if row.approved_by})
    grouped: dict = {trip.id: [] for trip in trips}
    for row in rows:
        grouped.setdefault(row.trip_id, []).append(row)
    payload = []
    for trip in trips:
        bookings = sorted(grouped.get(trip.id) or [], key=_sort_key)
        if not bookings:
            continue
        details = trip.details or {}
        location = details.get("location") or {}
        payload.append(
            {
                "id": str(trip.id),
                "title": trip.name,
                "status": trip.status,
                "location_name": details.get("place") or location.get("name") or "",
                "bookings": [_booking_payload(row, names) for row in bookings],
            }
        )
    return jsonify({"payment": _payment_summary(user), "trips": payload})
