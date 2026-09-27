"""Demo trips and sign-in users. Runs automatically when DEMO_MODE=true; safe to run repeatedly.

Sign in as Priya (+1 555 010 0001), Dev (+1 555 010 0002) or Marcus (+1 555 010 0003).
Dev was only on the Kyoto trip, so he sees one story; Priya sees both, plus an upcoming trip.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.auth import phone_to_jid
from app.extensions import db
from app.models import ACTIVE, Booking, BookingAuditLog, Group, Location, PaymentToken, Story, Suggestion, Trip, User

DEMO_DIR = Path(__file__).resolve().parent / "demo"

PEOPLE = {
    "Priya": phone_to_jid("+15550100001"),
    "Dev": phone_to_jid("+15550100002"),
    "Marcus": phone_to_jid("+15550100003"),
    "Ana": "demo-ana@s.whatsapp.net",
    "Jules": "demo-jules@s.whatsapp.net",
}

TRIPS = [
    {"file": "kyoto.json", "group_jid": "demo-kyoto@g.us", "crew": ["Priya", "Dev", "Marcus", "Ana"], "scene_key": "kyoto"},
    {"file": "desert.json", "group_jid": "demo-desert@g.us", "crew": ["Ana", "Priya", "Marcus", "Jules"], "scene_key": "sample"},
    {
        "data": {
            "slug": "big-sur",
            "name": "Big Sur long weekend",
            "status": ACTIVE,
            "started_at": "2026-10-16T17:00:00Z",
            "ended_at": "2026-10-19T20:00:00Z",
            "group_name": "Big Sur crew",
            "details": {
                "place": "Big Sur, California",
                "location": {"name": "Big Sur", "lat": 36.2704, "lng": -121.8081},
                "crew_order": ["Priya", "Marcus"],
                "cover": None,
            },
        },
        "group_jid": "demo-bigsur@g.us",
        "crew": ["Priya", "Marcus"],
    },
]


def _when(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def _user(name: str) -> User:
    jid = PEOPLE[name]
    user = db.session.query(User).filter_by(whatsapp_jid=jid).one_or_none()
    if user is None:
        user = User(whatsapp_jid=jid, display_name=name)
        db.session.add(user)
    return user


def _group(jid: str, name: str) -> Group:
    group = db.session.query(Group).filter_by(whatsapp_jid=jid).one_or_none()
    if group is None:
        group = Group(whatsapp_jid=jid, name=name)
        db.session.add(group)
    return group


def seed() -> None:
    """Adds anything missing. Leaves the caller to commit."""
    for spec in TRIPS:
        data = spec.get("data") or json.loads((DEMO_DIR / spec["file"]).read_text())
        if db.session.query(Trip).filter_by(slug=data["slug"]).one_or_none():
            continue
        trip = Trip(
            group=_group(spec["group_jid"], data["group_name"]),
            name=data["name"],
            slug=data["slug"],
            status=data["status"],
            started_at=_when(data["started_at"]),
            ended_at=_when(data.get("ended_at")),
            details={**data["details"], "scene_key": spec.get("scene_key")},
            participants=[_user(name) for name in spec["crew"]],
        )
        db.session.add(trip)
        for i, loc in enumerate(data.get("locations", [])):
            db.session.add(
                Location(
                    trip=trip,
                    name=loc["name"],
                    latitude=loc["latitude"],
                    longitude=loc["longitude"],
                    arrived_at=trip.started_at + timedelta(hours=i),
                    source="demo",
                )
            )
        if data.get("segments"):
            db.session.add(Story(trip=trip, kind="full", title=data["name"], status="ready", segments=data["segments"]))
        for item in data.get("suggestions", []):
            choices = []
            for raw in item.get("alternatives") or []:
                choice = " ".join(str(raw or "").split())[:100]
                if choice and choice not in choices:
                    choices.append(choice)
            db.session.add(
                Suggestion(trip=trip, body=item["body"], rationale=item.get("rationale", ""), choices=choices[:11])
            )
        db.session.flush()

    for name in ("Priya", "Dev", "Marcus"):
        user = _user(name)
        db.session.flush()
        if db.session.query(PaymentToken).filter_by(user_id=user.id).one_or_none() is None:
            db.session.add(
                PaymentToken(
                    user_id=user.id,
                    token_ref=f"vic-demo-{name.casefold()}",
                    provider="mock_vic",
                    spend_limit=500,
                    currency="USD",
                )
            )
    _seed_plans()


def _seed_plans() -> None:
    """One upcoming plan for the demo, so the Plans window is not empty."""
    trip = db.session.query(Trip).filter_by(slug="big-sur").one_or_none()
    if trip is None or db.session.query(Booking).filter_by(trip_id=trip.id).first():
        return
    deadline = datetime.now(timezone.utc) + timedelta(days=2)
    waiting = str(uuid.uuid4())
    booked = str(uuid.uuid4())
    passed = str(uuid.uuid4())
    db.session.add_all(
        [
            Booking(
                trip_id=trip.id,
                item_type="activity",
                time_slot="morning",
                candidate_json={
                    "name": "Bixby Creek overlook walk",
                    "item_type": "activity",
                    "price": 18,
                    "currency": "USD",
                    "time_slot": "morning",
                    "start_time": "09:00",
                    "book_ref": "mock-bixby-0900",
                },
                status="proposed",
                proposal_ref=waiting,
                is_primary=True,
                approval_deadline=deadline,
            ),
            Booking(
                trip_id=trip.id,
                item_type="activity",
                time_slot="morning",
                candidate_json={
                    "name": "Pfeiffer Beach wander",
                    "item_type": "activity",
                    "price": 12,
                    "currency": "USD",
                    "time_slot": "morning",
                    "start_time": "10:30",
                    "book_ref": "mock-pfeiffer-1030",
                },
                status="proposed",
                proposal_ref=waiting,
                is_primary=False,
                approval_deadline=deadline,
            ),
            Booking(
                trip_id=trip.id,
                item_type="restaurant",
                time_slot="evening",
                candidate_json={
                    "name": "Roadside oyster bar",
                    "item_type": "restaurant",
                    "price": 42,
                    "currency": "USD",
                    "time_slot": "evening",
                    "start_time": "18:00",
                    "book_ref": "mock-oyster-1800",
                },
                status="declined",
                proposal_ref=passed,
                is_primary=False,
                approval_deadline=deadline,
                last_error="The group picked a different table.",
            ),
        ]
    )
    dinner = Booking(
        trip_id=trip.id,
        item_type="restaurant",
        time_slot="evening",
        candidate_json={
            "name": "Nepenthe terrace dinner",
            "item_type": "restaurant",
            "price": 58,
            "currency": "USD",
            "time_slot": "evening",
            "start_time": "18:30",
            "book_ref": "mock-nepenthe-1830",
        },
        status="confirmed",
        proposal_ref=booked,
        is_primary=True,
        approved_by=PEOPLE["Priya"],
        approval_deadline=deadline,
    )
    db.session.add(dinner)
    db.session.flush()
    correlation = "3e1b7943-6567-4965-a32b-5aa93d057d35"
    instruction_id = str(uuid.uuid4())
    for event_type, response in (
        ("card_enrolled", {"clientCorrelationId": correlation, "status": "ACTIVE"}),
        ("purchase_intent", {"clientCorrelationId": correlation, "instructionId": instruction_id}),
        ("payment_credentials", {"clientCorrelationId": correlation, "status": "COMPLETED"}),
        (
            "transaction_confirmed",
            {"clientCorrelationId": correlation, "status": "COMPLETED", "signedPayload": "jws-signed-payload"},
        ),
        ("confirmed", {"confirmation_ref": "CF-NEPENTHE-4C91", "price": 58, "currency": "USD"}),
    ):
        db.session.add(
            BookingAuditLog(
                booking_id=dinner.id,
                event_type=event_type,
                actor_jid=PEOPLE["Priya"],
                provider_response=response,
            )
        )


def main() -> None:
    from app import create_app

    app = create_app()
    with app.app_context():
        seed()
        db.session.commit()
        for trip in db.session.query(Trip).filter(Trip.slug.in_(["kyoto", "desert", "big-sur"])):
            print(f"{trip.slug}: {', '.join(trip.crew())}")


if __name__ == "__main__":
    main()
