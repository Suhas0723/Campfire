import logging
from datetime import datetime, timezone

from flask import current_app
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import ACTIVE, ENDED, PAUSED, Group, Message, Trip, User
from app.redis_streams import publish_outbound
from app.services.bookings import bind_outbound_message, handle_approval

logger = logging.getLogger(__name__)

HELP_TEXT = "\n".join(
    [
        "Campfire commands:",
        "/campfire start",
        "/campfire end",
        "/campfire off the record",
        "/campfire on the record",
        "/campfire forget",
    ]
)


def parse_command(text: str) -> str | None:
    if not text:
        return None
    cleaned = " ".join(text.strip().split())
    lowered = cleaned.lower()
    if not lowered.startswith("/campfire"):
        return None
    rest = lowered[len("/campfire") :].strip()
    return {
        "": "help",
        "help": "help",
        "start": "start",
        "end": "end",
        "off the record": "off_the_record",
        "on the record": "on_the_record",
        "forget": "forget",
    }.get(rest, "unknown")


def handle_inbound(payload: dict) -> None:
    if payload.get("type") == "outbound_sent":
        bind_outbound_message(payload)
        return
    if payload.get("direct"):
        logger.info("Side-quest reply from %s is waiting on a handler", payload.get("sender_jid"))
        return

    if handle_approval(payload):
        return
    command = parse_command(payload.get("text") or "")
    if command:
        _handle_command(payload, command)
        return
    _capture(payload)


def _upsert_group(jid: str, subject: str | None) -> Group:
    group = db.session.query(Group).filter_by(whatsapp_jid=jid).one_or_none()
    if group is None:
        group = Group(whatsapp_jid=jid, name=subject or "Trip")
        db.session.add(group)
        db.session.flush()
    elif subject and group.name != subject:
        group.name = subject
    return group


def _upsert_user(jid: str, push_name: str | None) -> User:
    user = db.session.query(User).filter_by(whatsapp_jid=jid).one_or_none()
    if user is None:
        user = User(whatsapp_jid=jid, display_name=push_name or jid)
        db.session.add(user)
        db.session.flush()
    elif push_name and user.display_name != push_name:
        user.display_name = push_name
    return user


def _open_trip(group: Group) -> Trip | None:
    return (
        db.session.query(Trip)
        .filter(Trip.group_id == group.id, Trip.status.in_((ACTIVE, PAUSED)))
        .order_by(Trip.started_at.desc())
        .first()
    )


def _join(trip: Trip, user: User) -> None:
    if user not in trip.participants:
        trip.participants.append(user)


def _handle_command(payload: dict, command: str) -> None:
    group_jid = payload.get("group_jid")
    sender_jid = payload.get("sender_jid")
    if not group_jid or not sender_jid:
        raise ValueError("inbound command is missing a jid")

    group = _upsert_group(group_jid, payload.get("group_subject"))
    user = _upsert_user(sender_jid, payload.get("push_name"))
    trip = _open_trip(group)
    reply = HELP_TEXT

    if command == "start":
        if trip is not None:
            reply = "A trip is already open in this chat. /campfire end closes it."
        else:
            trip = Trip(group=group, name=group.name or "Trip", status=ACTIVE)
            db.session.add(trip)
            db.session.flush()
            _join(trip, user)
            reply = (
                "Campfire is listening for this trip. Each night I'll post a short recap "
                "from what you already send here.\n"
                "• /campfire start - start listening to this trip\n"
                "• /campfire end - stop listening and post the story link\n"
                "• /campfire off the record - pause, and don't save anything until you're back\n"
                "• /campfire on the record - start listening again\n"
                "• /campfire forget - drop your last message, or reply to one of yours to drop that one\n"
                "• /campfire help - show these commands"
            )
    elif command == "end":
        if trip is None:
            reply = "There's no open trip. /campfire start begins one."
        else:
            trip.status = ENDED
            trip.ended_at = datetime.now(timezone.utc)
            link = f"{current_app.config['PUBLIC_APP_URL']}/play/{trip.id}"
            reply = (
                "Trip's closed. I stopped listening. "
                f"Around the Campfire for this trip: {link}"
            )
    elif command == "off_the_record":
        if trip is None:
            reply = "There's no open trip. /campfire start begins one."
        elif trip.status == PAUSED:
            reply = "Already paused. /campfire on the record when you want me back."
        else:
            trip.status = PAUSED
            reply = "Paused. I won't keep anything until /campfire on the record."
    elif command == "on_the_record":
        if trip is None:
            reply = "There's no open trip. /campfire start begins one."
        elif trip.status == ACTIVE:
            reply = "I'm already listening."
        else:
            trip.status = ACTIVE
            reply = "Listening again."
    elif command == "forget":
        reply = _forget(trip, user, payload.get("quoted_message_id"))
    elif command != "help":
        reply = "I don't know that one. /campfire help lists what I understand."

    ended_trip_id = trip.id if command == "end" and trip is not None and trip.status == ENDED else None
    db.session.commit()
    if ended_trip_id is not None:
        _enqueue_full_story(ended_trip_id)
    try:
        publish_outbound(group_jid, message_type="text", text=reply)
    except Exception:
        logger.exception("Saved the command but could not publish the reply")


def _forget(trip: Trip | None, user: User, quoted_message_id: str | None) -> str:
    if trip is None or trip.status not in (ACTIVE, PAUSED):
        return "There's no open trip to forget from."

    query = db.session.query(Message).filter_by(trip_id=trip.id, excluded=False)
    if quoted_message_id:
        message = query.filter_by(whatsapp_message_id=quoted_message_id).one_or_none()
        if message is None:
            return "I don't have that message."
        if message.sender_id != user.id:
            return "I can only drop messages you sent."
    else:
        message = query.filter_by(sender_id=user.id).order_by(Message.sent_at.desc()).first()
        if message is None:
            return "I don't have anything of yours from this trip."

    message.excluded = True
    return "Dropped that from the trip."


def _capture(payload: dict) -> None:
    group_jid = payload.get("group_jid")
    sender_jid = payload.get("sender_jid")
    message_id = payload.get("message_id")
    if not group_jid or not sender_jid or not message_id:
        raise ValueError("inbound message is missing an id")

    group = db.session.query(Group).filter_by(whatsapp_jid=group_jid).one_or_none()
    if group is None:
        return

    trip = _open_trip(group)
    if trip is None or trip.status != ACTIVE:
        return

    body = payload.get("text") or ""
    media_path = payload.get("media_path")
    if not body and not media_path:
        return

    user = _upsert_user(sender_jid, payload.get("push_name"))
    _join(trip, user)
    sent_at = datetime.fromtimestamp(int(payload.get("timestamp") or 0), tz=timezone.utc)
    if sent_at.year < 2000:
        sent_at = datetime.now(timezone.utc)

    message = Message(
        trip_id=trip.id,
        sender_id=user.id,
        whatsapp_message_id=message_id,
        type=payload.get("type") or "text",
        body=body,
        media_path=media_path,
        quoted_message_id=payload.get("quoted_message_id"),
        sent_at=sent_at,
    )
    db.session.add(message)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        logger.info("Duplicate WhatsApp message %s", message_id)
        return

    if message.type == "audio" and message.media_path:
        _enqueue_transcription(message.id)


def _enqueue_transcription(message_id) -> None:
    try:
        from app.tasks import transcribe_message

        transcribe_message.delay(str(message_id))
    except Exception:
        logger.exception("Could not enqueue transcription for %s", message_id)


def _enqueue_full_story(trip_id) -> None:
    try:
        from app.tasks import assemble_full_story

        assemble_full_story.delay(str(trip_id))
    except Exception:
        logger.exception("Could not enqueue the full story for %s", trip_id)
