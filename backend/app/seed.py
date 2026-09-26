"""Load a sample ended trip so Around the Campfire can be opened without WhatsApp."""

from datetime import datetime, timezone

from app import create_app
from app.extensions import db
from app.models import ENDED, Group, Location, Story, Suggestion, Trip, User

SLUG = "yosemite-weekend"

SEGMENTS = [
    {
        "order": 0,
        "kind": "narration",
        "text": (
            "You rolled in through Arch Rock in the late afternoon, already arguing "
            "about who had packed the good snacks."
        ),
        "audio_url": None,
        "photo_url": None,
        "location": {"name": "Arch Rock", "lat": 37.6818, "lng": -119.7885},
        "speaker": None,
    },
    {
        "order": 1,
        "kind": "voice_note",
        "text": "Okay. The valley just opened up and nobody is talking. That's new.",
        "audio_url": None,
        "photo_url": None,
        "location": {"name": "Tunnel View", "lat": 37.7157, "lng": -119.6772},
        "speaker": "Riley",
    },
    {
        "order": 2,
        "kind": "narration",
        "text": (
            "Tunnel View did that thing it always does. The group went quiet, "
            "then immediately started ranking other views they had ever stood in."
        ),
        "audio_url": None,
        "photo_url": None,
        "location": {"name": "Tunnel View", "lat": 37.7157, "lng": -119.6772},
        "speaker": None,
    },
    {
        "order": 3,
        "kind": "photo",
        "text": "Last light from Glacier Point. Alex was behind the camera the whole time.",
        "audio_url": None,
        "photo_url": None,
        "location": {"name": "Glacier Point", "lat": 37.7304, "lng": -119.5736},
        "speaker": "Alex",
    },
    {
        "order": 4,
        "kind": "narration",
        "text": (
            "On the way down someone said next time they wanted a kitchen. "
            "The valley kept the last of the light a little longer than the forecast."
        ),
        "audio_url": None,
        "photo_url": None,
        "location": {"name": "Glacier Point", "lat": 37.7304, "lng": -119.5736},
        "speaker": None,
    },
]


def main() -> None:
    app = create_app()
    with app.app_context():
        existing = db.session.query(Trip).filter_by(slug=SLUG).one_or_none()
        if existing:
            print(f"{app.config['PUBLIC_APP_URL']}/play/{existing.id}")
            return

        group = Group(whatsapp_jid="demo-group@g.us", name="Yosemite")
        alex = User(whatsapp_jid="demo-alex@s.whatsapp.net", display_name="Alex")
        riley = User(whatsapp_jid="demo-riley@s.whatsapp.net", display_name="Riley")
        jordan = User(whatsapp_jid="demo-jordan@s.whatsapp.net", display_name="Jordan")
        trip = Trip(
            group=group,
            name="Yosemite weekend",
            slug=SLUG,
            status=ENDED,
            started_at=datetime(2026, 6, 6, 18, 0, tzinfo=timezone.utc),
            ended_at=datetime(2026, 6, 8, 20, 0, tzinfo=timezone.utc),
            participants=[alex, riley, jordan],
        )
        db.session.add(trip)
        db.session.flush()

        stops = [
            ("Arch Rock", 37.6818, -119.7885, datetime(2026, 6, 6, 22, 10, tzinfo=timezone.utc)),
            ("Tunnel View", 37.7157, -119.6772, datetime(2026, 6, 7, 1, 5, tzinfo=timezone.utc)),
            ("Glacier Point", 37.7304, -119.5736, datetime(2026, 6, 8, 2, 40, tzinfo=timezone.utc)),
        ]
        for name, latitude, longitude, arrived_at in stops:
            db.session.add(
                Location(
                    trip_id=trip.id,
                    name=name,
                    latitude=latitude,
                    longitude=longitude,
                    arrived_at=arrived_at,
                    source="seed",
                )
            )

        db.session.add(
            Story(
                trip_id=trip.id,
                kind="full",
                title="Around the Campfire",
                script="\n\n".join(segment["text"] for segment in SEGMENTS),
                status="ready",
                segments=SEGMENTS,
            )
        )
        db.session.add(
            Suggestion(
                trip_id=trip.id,
                body="A cabin with a kitchen, still in the Sierra.",
                rationale="The chat kept circling back to the cost of dinner and how long the drives between meals felt.",
            )
        )
        db.session.commit()
        print(f"{app.config['PUBLIC_APP_URL']}/play/{trip.id}")


if __name__ == "__main__":
    main()
