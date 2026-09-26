"""Demo trips and sign-in users. Runs automatically when DEMO_MODE=true; safe to run repeatedly.

Sign in as Priya (+1 555 010 0001), Dev (+1 555 010 0002) or Marcus (+1 555 010 0003).
Dev was only on the Kyoto trip, so he sees one story; Priya sees both, plus an upcoming trip.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

from app.auth import phone_to_jid
from app.extensions import db
from app.models import ACTIVE, Group, Location, Story, Suggestion, Trip, User

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
            db.session.add(Suggestion(trip=trip, body=item["body"], rationale=item.get("rationale", "")))
        db.session.flush()


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
