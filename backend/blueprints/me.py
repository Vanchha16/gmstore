import re
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from passlib.hash import bcrypt
from extensions import db
from models.user import User

me_bp = Blueprint("me", __name__, url_prefix="/api/v1/me")


def _get_user():
    return User.query.get(int(get_jwt_identity()))


@me_bp.get("")
@jwt_required()
def get_me():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify(user.to_dict()), 200


@me_bp.patch("")
@jwt_required()
def update_me():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json(silent=True) or {}
    errors = {}

    if "full_name" in data:
        name = data["full_name"].strip()
        if not name:
            errors["full_name"] = "Name cannot be empty."
        elif len(name) > 120:
            errors["full_name"] = "Name is too long (max 120 chars)."
        else:
            user.full_name = name

    if "phone" in data:
        phone = (data["phone"] or "").strip()
        if phone and not re.match(r"^\+?[\d\s\-()]{6,20}$", phone):
            errors["phone"] = "Invalid phone number format."
        else:
            user.phone = phone or None

    if "avatar_url" in data:
        url = (data["avatar_url"] or "").strip()
        user.avatar_url = url or None

    if errors:
        return jsonify({"error": "Validation failed.", "fields": errors}), 400

    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(user.to_dict()), 200


@me_bp.patch("/password")
@jwt_required()
def change_password():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json(silent=True) or {}
    old_pw = data.get("old_password", "")
    new_pw = data.get("new_password", "")

    if not old_pw or not new_pw:
        return jsonify({"error": "old_password and new_password are required."}), 400
    if not bcrypt.verify(old_pw, user.password_hash):
        return jsonify({"error": "Current password is incorrect."}), 401
    if len(new_pw) < 8:
        return jsonify({"error": "New password must be at least 8 characters."}), 400
    if old_pw == new_pw:
        return jsonify({"error": "New password must be different from the current one."}), 400

    user.password_hash = bcrypt.hash(new_pw)
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"message": "Password updated successfully."}), 200


@me_bp.get("/favorites")
@jwt_required()
def get_my_favorites():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found."}), 404
    from models.favorite import Favorite
    favs = Favorite.query.filter_by(user_id=user.id).all()
    return jsonify([f.to_dict() for f in favs]), 200


@me_bp.get("/preorders")
@jwt_required()
def get_my_preorders():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found."}), 404
    from models.preorder import Preorder
    pos = Preorder.query.filter_by(user_id=user.id).filter(Preorder.status != "cancelled").all()
    return jsonify([po.to_dict() for po in pos]), 200


@me_bp.get("/orders")
@jwt_required()
def get_my_orders():
    user = _get_user()
    if not user:
        return jsonify({"error": "User not found."}), 404
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 10)), 50)
    from models.order import Order
    q = Order.query.filter_by(user_id=user.id).order_by(Order.created_at.desc())
    total = q.count()
    orders = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({"items": [o.to_dict() for o in orders], "total": total, "page": page, "limit": limit}), 200


@me_bp.get("/orders/<int:order_id>")
@jwt_required()
def get_my_order_detail(order_id):
    user_id = int(get_jwt_identity())
    from models.order import Order
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    return jsonify(order.to_dict()), 200


@me_bp.post("/orders/<int:order_id>/cancel")
@jwt_required()
def cancel_my_order(order_id):
    user_id = int(get_jwt_identity())
    from models.order import Order
    from services.inventory_service import cancel_order
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    try:
        cancelled = cancel_order(order.id)
        return jsonify({"message": "Order cancelled.", "order": cancelled.to_dict()}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@me_bp.post("/orders/<int:order_id>/confirm-delivery")
@jwt_required()
def confirm_my_order_delivery(order_id):
    user_id = int(get_jwt_identity())
    from models.order import Order
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    if order.status != "fulfilled":
        return jsonify({"error": "Cannot confirm delivery for an unfulfilled order."}), 400

    order.delivery_confirmed = True
    db.session.commit()
    return jsonify({"message": "Delivery confirmed.", "order": order.to_dict()}), 200
