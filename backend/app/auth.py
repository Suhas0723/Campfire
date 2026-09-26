"""Session helpers: who is signed in, and which trips they may see."""

import functools
import uuid

import phonenumbers
from flask import g, jsonify, session

from app.extensions import db
from app.models import Trip, User

JID_SUFFIX = "@s.whatsapp.net"


def normalize_phone(raw) -> str | None:
    """Return the number in E.164 form, or None if it can't be a phone number."""
    if not isinstance(raw, str) or not raw.strip() or len(raw) > 32:
        return None
    try:
        parsed = phonenumbers.parse(raw.strip(), None)
    except phonenumbers.NumberParseException:
        return None
    if not phonenumbers.is_possible_number(parsed):
        return None
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def phone_to_jid(phone: str) -> str:
    return f"{phone.lstrip('+')}{JID_SUFFIX}"


def jid_to_phone(jid: str) -> str | None:
    if not jid.endswith(JID_SUFFIX):
        return None
    digits = jid[: -len(JID_SUFFIX)].split(":")[0]
    return f"+{digits}" if digits.isdigit() else None


def user_by_phone(phone: str) -> User | None:
    return db.session.query(User).filter_by(whatsapp_jid=phone_to_jid(phone)).one_or_none()


def user_to_dict(user: User) -> dict:
    return {"id": str(user.id), "name": user.display_name, "phone": jid_to_phone(user.whatsapp_jid)}


def current_user() -> User | None:
    if "current_user" not in g:
        user = None
        raw = session.get("uid")
        if raw:
            try:
                user = db.session.get(User, uuid.UUID(raw))
            except ValueError:
                user = None
            if user is None:
                session.clear()
        g.current_user = user
    return g.current_user


def login_required(view):
    @functools.wraps(view)
    def wrapper(*args, **kwargs):
        if current_user() is None:
            return jsonify({"error": "Sign in to continue", "code": "unauthenticated"}), 401
        return view(*args, **kwargs)

    return wrapper


def trips_for(user: User):
    return db.session.query(Trip).join(Trip.participants).filter(User.id == user.id)


def trip_for_current_user(trip_id) -> Trip | None:
    """The trip if the signed-in user took part in it. Anyone else gets None, never a hint it exists."""
    user = current_user()
    if user is None:
        return None
    return trips_for(user).filter(Trip.id == trip_id).one_or_none()
