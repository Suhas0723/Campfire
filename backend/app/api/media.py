from pathlib import Path

from flask import Blueprint, abort, current_app, send_file

bp = Blueprint("media", __name__)


@bp.get("/media/<path:name>")
def media(name: str):
    root = Path(current_app.config["MEDIA_DIR"]).resolve()
    target = (root / name).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        abort(404)
    return send_file(target)
