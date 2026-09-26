from flask import Blueprint, jsonify
from sqlalchemy import nulls_last

from app.extensions import db
from app.models import Story, Suggestion, Trip

bp = Blueprint("trips", __name__)


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


@bp.get("/trips")
def list_trips():
    trips = db.session.query(Trip).order_by(Trip.started_at.desc()).all()
    return jsonify([trip.to_dict() for trip in trips])


@bp.get("/trips/<uuid:trip_id>")
def get_trip(trip_id):
    trip = db.session.get(Trip, trip_id)
    if trip is None:
        return jsonify({"error": "Trip not found"}), 404
    return jsonify(trip.to_dict())


@bp.get("/trips/<uuid:trip_id>/playback")
def playback(trip_id):
    trip = db.session.get(Trip, trip_id)
    if trip is None:
        return jsonify({"error": "Trip not found"}), 404
    suggestions = (
        db.session.query(Suggestion)
        .filter_by(trip_id=trip.id)
        .order_by(Suggestion.created_at.asc())
        .all()
    )
    return jsonify(
        {
            "trip": trip.to_dict(),
            "locations": [location.to_dict() for location in trip.locations],
            "segments": _segments_for(trip),
            "suggestions": [{"body": item.body, "rationale": item.rationale} for item in suggestions],
        }
    )
