from flask import Blueprint, jsonify
from sqlalchemy import text

from app.extensions import db

bp = Blueprint("health", __name__)


@bp.get("/api/health")
def health():
    db.session.execute(text("SELECT 1"))
    return jsonify({"status": "ok"})
