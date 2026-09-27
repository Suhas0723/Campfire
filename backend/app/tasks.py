import logging
import uuid
from datetime import datetime, timezone

from app.celery_app import celery
from app.extensions import db
from app.models import ENDED, Message, Trip
from app.services.llm import IntegrationNotConfigured
from app.services.bookings import book_and_pay, expire_proposals
from app.services.story import assemble_full, end_night_now, run_due_recaps
from app.services.transcription import transcribe

logger = logging.getLogger(__name__)


def _plus_one_year(value):
    try:
        return value.replace(year=value.year + 1)
    except ValueError:
        return value.replace(month=2, day=28, year=value.year + 1)


@celery.task(bind=True, max_retries=3, default_retry_delay=30, name="campfire.transcribe_message")
def transcribe_message(self, message_id: str) -> None:
    """Write an ElevenLabs transcript onto one captured voice note."""
    try:
        message_uuid = uuid.UUID(message_id)
    except ValueError:
        logger.info("Ignoring transcription for invalid id %s", message_id)
        return

    message = db.session.get(Message, message_uuid)
    if (
        message is None
        or message.excluded
        or message.type != "audio"
        or not message.media_path
        or message.transcript is not None
    ):
        return

    try:
        message.transcript = transcribe(message.media_path)
        db.session.commit()
    except IntegrationNotConfigured:
        db.session.rollback()
        logger.info("ElevenLabs is unset; left %s without a transcript", message_id)
    except Exception as exc:
        db.session.rollback()
        logger.exception("Transcription failed for %s", message_id)
        raise self.retry(exc=exc) from exc


@celery.task(name="campfire.generate_due_recaps")
def generate_due_recaps():
    """Assemble a nightly recap once local time passes the recap hour."""
    return run_due_recaps()


@celery.task(name="campfire.end_night")
def end_night(trip_id: str) -> dict:
    """Same nightly recap and Muse tips as the scheduled job, started early from the app."""
    return end_night_now(trip_id)


@celery.task(name="campfire.assemble_full_story")
def assemble_full_story(trip_id: str) -> None:
    """Write the end-of-trip story the playback page reads."""
    assemble_full(trip_id)


@celery.task(name="campfire.book_and_pay")
def book_and_pay_task(booking_id: str) -> None:
    """Book exactly once after an explicit, audited chat approval."""
    book_and_pay(booking_id)


@celery.task(name="campfire.expire_booking_proposals")
def expire_booking_proposals() -> int:
    """Fail closed when a proposal passes its local morning cutoff."""
    return expire_proposals()


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
