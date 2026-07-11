from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from extensions import db
from models.user import User
from utils.decorators import role_required

admin_users_bp = Blueprint("admin_users", __name__, url_prefix="/api/v1/admin/users")


# GET /api/v1/admin/users
@admin_users_bp.get("")
@role_required("admin")
def list_users():
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    q_str = request.args.get("q", "").strip()
    role = request.args.get("role", "").strip()

    q = User.query
    if q_str:
        q = q.filter(
            db.or_(
                User.email.ilike(f"%{q_str}%"),
                User.full_name.ilike(f"%{q_str}%"),
            )
        )
    if role in ("customer", "admin"):
        q = q.filter(User.role == role)
    q = q.order_by(User.created_at.desc())

    total = q.count()
    users = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({
        "items": [u.to_dict() for u in users],
        "total": total,
        "page": page,
        "limit": limit,
    }), 200


# GET /api/v1/admin/users/<int:user_id>
@admin_users_bp.get("/<int:user_id>")
@role_required("admin")
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200


# PATCH /api/v1/admin/users/<int:user_id>
@admin_users_bp.patch("/<int:user_id>")
@role_required("admin")
def update_user(user_id):
    acting_admin_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)

    # Prevent admins from demoting or banning themselves
    if user.id == acting_admin_id:
        return jsonify({"error": "You cannot modify your own account from here."}), 400

    data = request.get_json(silent=True) or {}

    if "role" in data:
        if data["role"] not in ("customer", "admin"):
            return jsonify({"error": "role must be 'customer' or 'admin'."}), 400
        user.role = data["role"]

    if "is_banned" in data:
        user.is_banned = bool(data["is_banned"])

    db.session.commit()
    return jsonify(user.to_dict()), 200
