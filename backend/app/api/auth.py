import hashlib
import hmac
import json
import logging
import re
import secrets

from flask import Blueprint, current_app, jsonify, request, session

from app.auth import current_user, ensure_user, login_required, normalize_phone, phone_to_jid, user_to_dict
from app.redis_streams import LOGIN_CODE_STREAM, client

bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)

CODE_TTL = 600
MAX_ATTEMPTS = 5
REQUESTS_PER_WINDOW = 3
RATE_WINDOW = 600
RESEND_AFTER = 30
DEMO_CODE = "000000"

# Atomically count an attempt, but only while the code still exists; a bare HINCRBY
# on an expired key would recreate it without a TTL.
_ATTEMPT = """
if redis.call('EXISTS', KEYS[1]) == 0 then return nil end
local n = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
return {n, redis.call('HGET', KEYS[1], 'hash')}
"""


def _error(code: str, message: str, status: int, **extra):
    return jsonify({"error": message, "code": code, **extra}), status


def _json_body():
    if not request.is_json:
        return None
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None


def _hash(phone: str, code: str) -> str:
    key = current_app.config["SECRET_KEY"].encode()
    return hmac.new(key, f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


@bp.post("/auth/request-code")
def request_code():
    body = _json_body()
    if body is None:
        return _error("bad_request", "Send JSON", 415)
    phone = normalize_phone(body.get("phone"))
    if phone is None:
        return _error("invalid_phone", "That doesn't look like a phone number", 400)

    r = client()
    if not r.set(f"auth:cooldown:{phone}", 1, nx=True, ex=RESEND_AFTER):
        return _error("wait", "Wait a moment before asking again", 429, retry_after=max(r.ttl(f"auth:cooldown:{phone}"), 1))

    rate_key = f"auth:rl:{phone}"
    count = r.incr(rate_key)
    if count == 1:
        r.expire(rate_key, RATE_WINDOW)
    if count > REQUESTS_PER_WINDOW:
        return _error("rate_limited", "Too many codes requested", 429, retry_after=max(r.ttl(rate_key), 1))

    code = f"{secrets.randbelow(1_000_000):06d}"
    code_key = f"auth:code:{phone}"
    pipe = r.pipeline()
    pipe.delete(code_key)
    pipe.hset(code_key, mapping={"hash": _hash(phone, code), "attempts": 0})
    pipe.expire(code_key, CODE_TTL)
    pipe.execute()

    # The response is the same for every number. Outside demo mode the bot DMs the code.
    demo = current_app.config["DEMO_MODE"]
    if demo:
        logger.warning("DEMO_MODE login code for %s: %s", phone, code)
    else:
        job = {"jid": phone_to_jid(phone), "text": f"Your Campfire code is {code}. It expires in 10 minutes."}
        r.xadd(LOGIN_CODE_STREAM, {"data": json.dumps(job)}, maxlen=1000, approximate=True)

    return jsonify({"ok": True, "resend_after": RESEND_AFTER, "demo": demo})


@bp.post("/auth/verify")
def verify():
    body = _json_body()
    if body is None:
        return _error("bad_request", "Send JSON", 415)
    phone = normalize_phone(body.get("phone"))
    code = str(body.get("code", "")).strip()
    if phone is None:
        return _error("invalid_phone", "That doesn't look like a phone number", 400)
    if not re.fullmatch(r"\d{6}", code):
        return _error("wrong", "That code doesn't match", 400, remaining=None)

    r = client()
    result = r.eval(_ATTEMPT, 1, f"auth:code:{phone}")
    if result is None:
        return _error("expired", "That code has expired", 400)
    attempts, stored = int(result[0]), result[1]
    if attempts > MAX_ATTEMPTS:
        return _error("too_many", "Too many attempts", 429)

    matches = hmac.compare_digest(stored, _hash(phone, code))
    if current_app.config["DEMO_MODE"] and code == DEMO_CODE:
        matches = True
    if not matches:
        remaining = MAX_ATTEMPTS - attempts
        if remaining <= 0:
            return _error("too_many", "Too many attempts", 429)
        return _error("wrong", "That code doesn't match", 400, remaining=remaining)

    user = ensure_user(phone)
    r.delete(f"auth:code:{phone}", f"auth:cooldown:{phone}")
    session.clear()
    session.permanent = True
    session["uid"] = str(user.id)
    return jsonify({"user": user_to_dict(user)})


@bp.post("/auth/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@bp.get("/me")
@login_required
def me():
    return jsonify({"user": user_to_dict(current_user())})
