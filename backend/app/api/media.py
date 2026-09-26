from pathlib import Path

from flask import Blueprint, abort, current_app, send_file
from sqlalchemy import or_

from app.auth import login_required, trip_for_current_user
from app.extensions import db
from app.models import Message, Story

bp = Blueprint("media", __name__)


def _cited_in_segments(name: str):
    """Narration clips live only inside story segments, not on Story.audio_path."""
    url = f"/api/media/{name}"
    return (
        db.session.query(Story.trip_id)
        .filter(
            or_(
                Story.segments.contains([{"audio_url": url}]),
                Story.segments.contains([{"photo_url": url}]),
                Story.segments.contains([{"voices": {"woman": url}}]),
                Story.segments.contains([{"voices": {"man": url}}]),
            )
        )
        .first()
    )


def _trip_id_for(name: str):
    owner = db.session.query(Message.trip_id).filter(Message.media_path == name).first()
    if owner is None:
        owner = db.session.query(Story.trip_id).filter(Story.audio_path == name).first()
    if owner is None:
        owner = _cited_in_segments(name)
    return owner[0] if owner else None


@bp.get("/media/<path:name>")
@login_required
def media(name: str):
    root = Path(current_app.config["MEDIA_DIR"]).resolve()
    target = (root / name).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        abort(404)
    trip_id = _trip_id_for(name)
    if trip_id is None or trip_for_current_user(trip_id) is None:
        abort(404)
    return send_file(target)
