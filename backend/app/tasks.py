import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from flask import current_app

from app.celery_app import celery
from app.extensions import db
from app.models import ACTIVE, ENDED, Story, Trip

logger = logging.getLogger(__name__)


def _plus_one_year(value):
    try:
        return value.replace(year=value.year + 1)
    except ValueError:
        return value.replace(month=2, day=28, year=value.year + 1)


@celery.task(name="campfire.generate_due_recaps")
def generate_due_recaps():
    """Mark a pending nightly story once local time passes the recap hour.

    The script, voice note, and group post are not assembled yet. Creating the
    row keeps the hourly check from repeating itself all night.
    """
    zone = ZoneInfo(current_app.config["DEFAULT_TRIP_TIMEZONE"])
    now = datetime.now(zone)
    if now.hour < current_app.config["RECAP_HOUR"]:
        return 0

    created = 0
    trips = db.session.query(Trip).filter_by(status=ACTIVE).all()
    for trip in trips:
        exists = (
            db.session.query(Story)
            .filter_by(trip_id=trip.id, kind="nightly", for_date=now.date())
            .first()
        )
        if exists:
            continue
        db.session.add(
            Story(
                trip_id=trip.id,
                kind="nightly",
                for_date=now.date(),
                title=now.date().isoformat(),
                status="pending",
            )
        )
        created += 1
    db.session.commit()
    if created:
        logger.info(
            "Marked %s nightly recap(s) pending. Script generation is not wired yet.",
            created,
        )
    return created


@celery.task(name="campfire.send_due_anniversaries")
def send_due_anniversaries():
    """Log trips whose anniversary is today. Posting the callback comes later."""
    today = datetime.now(timezone.utc).date()
    due = 0
    trips = (
        db.session.query(Trip)
        .filter(
            Trip.status == ENDED,
            Trip.ended_at.is_not(None),
            Trip.anniversary_sent_at.is_(None),
        )
        .all()
    )
    for trip in trips:
        ended = trip.ended_at
        if ended.tzinfo is None:
            ended = ended.replace(tzinfo=timezone.utc)
        if _plus_one_year(ended.astimezone(timezone.utc).date()) == today:
            due += 1
            logger.info("Anniversary due for trip %s (%s)", trip.id, trip.name)
    return due
