from flask import Blueprint, jsonify
from extensions import db
from sqlalchemy import text

health_bp = Blueprint("health", __name__)


@health_bp.get("/api/v1/health")
def health_check():
    db_ok = False
    try:
        db.session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    return jsonify({"status": "ok", "db": "connected" if db_ok else "disconnected"})
