from datetime import datetime, timezone

from flask import Blueprint, jsonify
from sqlalchemy import nulls_last

from app.auth import current_user, login_required, trip_for_current_user, trips_for
from app.extensions import db
from app.models import Message, Story, Suggestion, Trip
from app.redis_streams import publish_outbound
from app.services.story import prepare_end_night

bp = Blueprint("trips", __name__)

NOT_FOUND = {"error": "Trip not found"}


def _ordered_locations(trip: Trip) -> list:
    def key(location):
        arrived = location.arrived_at
        if arrived is None:
            return datetime.min.replace(tzinfo=timezone.utc)
        if arrived.tzinfo is None:
            return arrived.replace(tzinfo=timezone.utc)
        return arrived

    return sorted(trip.locations, key=key)


def _segments_for(trip: Trip) -> list:
    full = (
        db.session.query(Story)
        .filter_by(trip_id=trip.id, kind="full")
        .order_by(Story.created_at.desc())
        .first()
    )
    if full and full.segments:
        return full.segments

    nightlies = (
        db.session.query(Story)
        .filter_by(trip_id=trip.id, kind="nightly")
        .order_by(nulls_last(Story.for_date.asc()), Story.created_at.asc())
        .all()
    )
    segments = []
    for nightly in nightlies:
        segments.extend(nightly.segments or [])
    return segments


def _chat_covers(trip_ids: list) -> dict:
    """Latest photo each trip actually received in the group chat."""
    if not trip_ids:
        return {}
    messages = (
        db.session.query(Message)
        .filter(
            Message.trip_id.in_(trip_ids),
            Message.type == "image",
            Message.excluded.is_(False),
            Message.media_path.isnot(None),
        )
        .order_by(Message.sent_at.desc())
        .all()
    )
    covers = {}
    for message in messages:
        if message.trip_id in covers:
            continue
        sender = message.sender.display_name.split()[0] if message.sender and message.sender.display_name else ""
        caption = " ".join((message.body or "").split())
        covers[message.trip_id] = {
            "label": caption[:80] if caption else "From the chat",
            "by": sender or "the group",
            "url": "/api/media/" + message.media_path.lstrip("/"),
        }
    return covers


def _summary(trip: Trip, chat_cover: dict | None = None) -> dict:
    details = trip.details or {}
    location = details.get("location")
    stored = details.get("cover") or None
    cover = chat_cover if chat_cover and not (stored or {}).get("url") else stored
    return {
        "id": str(trip.id),
        "slug": trip.slug,
        "title": trip.name,
        "status": trip.status,
        "location_name": details.get("place") or (location or {}).get("name") or "",
        "started_at": trip.started_at.isoformat() if trip.started_at else None,
        "ended_at": trip.ended_at.isoformat() if trip.ended_at else None,
        "participants": trip.crew(),
        "cover": cover,
        "story_ready": bool(_segments_for(trip)),
    }


@bp.get("/trips")
@login_required
def list_trips():
    trips = trips_for(current_user()).order_by(Trip.started_at.desc()).all()
    covers = _chat_covers([trip.id for trip in trips])
    return jsonify([_summary(trip, covers.get(trip.id)) for trip in trips])


@bp.get("/trips/<uuid:trip_id>")
@login_required
def get_trip(trip_id):
    trip = trip_for_current_user(trip_id)
    if trip is None:
        return jsonify(NOT_FOUND), 404
    return jsonify(trip.to_dict())


@bp.get("/trips/<uuid:trip_id>/playback")
@login_required
def playback(trip_id):
    trip = trip_for_current_user(trip_id)
    if trip is None:
        return jsonify(NOT_FOUND), 404
    suggestions = (
        db.session.query(Suggestion)
        .filter_by(trip_id=trip.id)
        .order_by(Suggestion.created_at.asc())
        .all()
    )
    return jsonify(
        {
            "trip": trip.to_dict(),
            "locations": [location.to_dict() for location in _ordered_locations(trip)],
            "segments": _segments_for(trip),
            "suggestions": [
                {"body": item.body, "rationale": item.rationale, "alternatives": list(item.choices or [])}
                for item in suggestions
            ],
        }
    )


def _poll_options(suggestions: list[Suggestion]) -> list[str]:
    options = []
    for item in suggestions:
        for raw in [item.body, *(item.choices or [])]:
            text = " ".join(str(raw or "").split())[:100]
            if text and text not in options:
                options.append(text)
            if len(options) >= 12:
                return options
    if len(options) == 1:
        options.append("Somewhere else")
    return options


@bp.post("/trips/<uuid:trip_id>/poll")
@login_required
def send_poll(trip_id):
    """Post the Next fire choices to the trip's WhatsApp group as a poll."""
    trip = trip_for_current_user(trip_id)
    if trip is None:
        return jsonify(NOT_FOUND), 404
    group = trip.group
    jid = group.whatsapp_jid if group else ""
    if not jid.endswith("@g.us") or jid.startswith("demo-"):
        return jsonify({"error": "This trip is not linked to a WhatsApp group.", "code": "no_group"}), 400
    suggestions = (
        db.session.query(Suggestion).filter_by(trip_id=trip.id).order_by(Suggestion.created_at.asc()).all()
    )
    options = _poll_options(suggestions)
    if len(options) < 2:
        return jsonify({"error": "No suggestion to put in a poll yet.", "code": "no_suggestion"}), 409
    publish_outbound(
        jid,
        message_type="poll",
        poll={"name": "Where should the next fire be?", "values": options},
    )
    return jsonify({"status": "queued", "group_name": group.name or trip.name, "options": options})


@bp.post("/trips/<uuid:trip_id>/end-night")
@login_required
def end_night_early(trip_id):
    """Start today's nightly recap and Muse tips before the scheduled hour."""
    trip = trip_for_current_user(trip_id)
    if trip is None:
        return jsonify(NOT_FOUND), 404
    outcome = prepare_end_night(trip)
    status = outcome.get("status")
    if status == "queued":
        from app.tasks import end_night

        end_night.delay(str(trip.id))
        return jsonify({"status": "started", "date": outcome.get("date")}), 202
    codes = {
        "already_done": 200,
        "in_progress": 202,
        "no_messages": 409,
        "not_active": 409,
    }
    messages = {
        "no_messages": "Nothing captured today yet.",
        "not_active": "This trip is not active.",
        "already_done": "Tonight’s recap is already in the chat.",
        "in_progress": "Tonight’s recap is already running.",
    }
    body = {**outcome, "code": status}
    if status in messages:
        body["error"] = messages[status]
    return jsonify(body), codes.get(status, 409)
