import json
import logging

import redis

from app import create_app
from app.extensions import db
from app.redis_streams import INBOUND_GROUP, INBOUND_STREAM, client
from app.services.inbound import handle_inbound

logger = logging.getLogger(__name__)


def _ensure_group(connection: redis.Redis) -> None:
    try:
        connection.xgroup_create(INBOUND_STREAM, INBOUND_GROUP, id="0", mkstream=True)
    except redis.exceptions.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


def main() -> None:
    app = create_app()
    with app.app_context():
        connection = client()
        _ensure_group(connection)
        logger.info("Ingest listening on %s", INBOUND_STREAM)
        while True:
            response = connection.xreadgroup(
                INBOUND_GROUP,
                "ingest-1",
                {INBOUND_STREAM: ">"},
                count=10,
                block=5000,
            )
            if not response:
                continue
            for _stream, messages in response:
                for message_id, fields in messages:
                    try:
                        payload = json.loads(fields.get("data") or "{}")
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


if __name__ == "__main__":
    main()
