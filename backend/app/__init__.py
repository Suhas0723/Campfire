import logging
import time
from pathlib import Path

from flask import Flask
from flask_cors import CORS
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config import Config
from app.extensions import db

logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    db.init_app(app)
    Path(app.config["MEDIA_DIR"]).mkdir(parents=True, exist_ok=True)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.api.health import bp as health_bp
    from app.api.media import bp as media_bp
    from app.api.trips import bp as trips_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(trips_bp, url_prefix="/api")
    app.register_blueprint(media_bp, url_prefix="/api")

    with app.app_context():
        from app import models  # noqa: F401

        init_database()

    return app


def init_database():
    last_error = None
    for _attempt in range(30):
        try:
            db.session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            db.session.commit()
            db.create_all()
            return
        except OperationalError as exc:
            db.session.rollback()
            last_error = exc
            logger.info("Waiting for Postgres...")
            time.sleep(1)
    raise RuntimeError("Postgres was not ready") from last_error
