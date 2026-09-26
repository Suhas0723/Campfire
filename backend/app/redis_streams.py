import json

import redis
from flask import current_app

INBOUND_STREAM = "campfire:inbound"
OUTBOUND_STREAM = "campfire:outbound"
INBOUND_GROUP = "backend"
OUTBOUND_GROUP = "whatsapp"
AWAITING_DM_KEY = "campfire:awaiting_dm"
LOGIN_CODE_STREAM = "campfire:login_codes"


def client() -> redis.Redis:
    return redis.Redis.from_url(current_app.config["REDIS_URL"], decode_responses=True)


def publish_outbound(
    group_jid: str,
    *,
    message_type: str,
    text: str | None = None,
    audio_path: str | None = None,
) -> None:
    payload = {
        "group_jid": group_jid,
        "type": message_type,
        "text": text,
        "audio_path": audio_path,
    }
    client().xadd(OUTBOUND_STREAM, {"data": json.dumps(payload)})


def expect_direct_reply(jid: str) -> None:
    """Allow a 1:1 reply from this jid through the WhatsApp bridge."""
    client().sadd(AWAITING_DM_KEY, jid)


def clear_direct_reply(jid: str) -> None:
    client().srem(AWAITING_DM_KEY, jid)
