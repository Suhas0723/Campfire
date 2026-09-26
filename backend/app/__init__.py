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
    CORS(app, resources={r"/api/*": {"origins": [app.config["PUBLIC_APP_URL"]]}}, supports_credentials=True)
    if app.config["SECRET_KEY"] in {"dev-change-me", "change-me"} and not app.config["DEMO_MODE"]:
        logger.warning("SECRET_KEY is the default; set a real one so session cookies can't be forged")

    from app.api.auth import bp as auth_bp
    from app.api.health import bp as health_bp
    from app.api.media import bp as media_bp
    from app.api.trips import bp as trips_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(trips_bp, url_prefix="/api")
    app.register_blueprint(media_bp, url_prefix="/api")

    with app.app_context():
        from app import models  # noqa: F401

        init_database(seed_demo=app.config["DEMO_MODE"])

    return app


def init_database(seed_demo: bool = False):
    last_error = None
    for _attempt in range(30):
        try:
            db.session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            db.session.commit()
            db.session.execute(text("SELECT pg_advisory_lock(8675309)"))
            try:
                db.create_all()
                db.session.execute(
                    text("ALTER TABLE trips ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb")
                )
                if seed_demo:
                    from app.seed_demo import seed

                    seed()
            finally:
                db.session.execute(text("SELECT pg_advisory_unlock(8675309)"))
                db.session.commit()
            return
        except OperationalError as exc:
            db.session.rollback()
            last_error = exc
            logger.info("Waiting for Postgres...")
            time.sleep(1)
    raise RuntimeError("Postgres was not ready") from last_error
