import json
import logging
import time

import redis

from app import create_app
from app.extensions import db
from app.redis_streams import INBOUND_GROUP, INBOUND_STREAM, client
from app.services.inbound import handle_inbound

logger = logging.getLogger(__name__)
CONSUMER = "ingest-1"


def _ensure_group(connection: redis.Redis) -> None:
    try:
        connection.xgroup_create(INBOUND_STREAM, INBOUND_GROUP, id="0", mkstream=True)
    except redis.exceptions.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


def _process(connection: redis.Redis, response) -> None:
    for _stream, messages in response or []:
        for message_id, fields in messages:
            try:
                payload = json.loads(fields.get("data") or "{}")
                logger.info(
                    "Inbound %s type=%s text=%r", message_id, payload.get("type"), (payload.get("text") or "")[:40]
                )
                handle_inbound(payload)
            except (KeyError, ValueError, json.JSONDecodeError):
                logger.exception("Dropping malformed inbound %s", message_id)
                db.session.rollback()
                connection.xack(INBOUND_STREAM, INBOUND_GROUP, message_id)
            except Exception:
                logger.exception("Will retry inbound %s", message_id)
                db.session.rollback()
            else:
                connection.xack(INBOUND_STREAM, INBOUND_GROUP, message_id)


def _listen() -> None:
    connection = client()
    _ensure_group(connection)
    logger.info("Ingest listening on %s", INBOUND_STREAM)
    # Entries left pending by an earlier crash are retried once at startup.
    # New entries are always read afterwards so one failing entry cannot block the stream.
    _process(connection, connection.xreadgroup(INBOUND_GROUP, CONSUMER, {INBOUND_STREAM: "0"}, count=10))
    while True:
        response = connection.xreadgroup(
            INBOUND_GROUP,
            CONSUMER,
            {INBOUND_STREAM: ">"},
            count=10,
            block=5000,
        )
        if response:
            _process(connection, response)


def main() -> None:
    app = create_app()
    with app.app_context():
        while True:
            try:
                _listen()
            except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError):
                logger.exception("Redis connection lost; reconnecting")
                time.sleep(2)


if __name__ == "__main__":
    main()
