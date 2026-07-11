from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from extensions import db
from models.promo_code import PromoCode
from utils.decorators import role_required

admin_promo_codes_bp = Blueprint("admin_promo_codes", __name__, url_prefix="/api/v1/admin/promo-codes")


def _parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Invalid date/time format: '{value}'.")


def _apply_fields(promo, data, is_create):
    if is_create or "code" in data:
        code = (data.get("code") or "").strip().upper()
        if not code:
            raise ValueError("code is required.")
        promo.code = code

    if is_create or "discount_type" in data:
        discount_type = data.get("discount_type")
        if discount_type not in ("percent", "fixed"):
            raise ValueError("discount_type must be 'percent' or 'fixed'.")
        promo.discount_type = discount_type

    if is_create or "discount_value" in data:
        try:
            discount_value = float(data.get("discount_value"))
        except (TypeError, ValueError):
            raise ValueError("discount_value must be a number.")
        if discount_value <= 0:
            raise ValueError("discount_value must be greater than zero.")
        promo.discount_value = discount_value

    if "min_order_amount" in data:
        promo.min_order_amount = float(data["min_order_amount"]) if data["min_order_amount"] not in (None, "") else None
    if "max_uses" in data:
        promo.max_uses = int(data["max_uses"]) if data["max_uses"] not in (None, "") else None
    if "max_uses_per_user" in data:
        promo.max_uses_per_user = int(data["max_uses_per_user"]) if data["max_uses_per_user"] not in (None, "") else None
    if "starts_at" in data:
        promo.starts_at = _parse_datetime(data["starts_at"])
    if "expires_at" in data:
        promo.expires_at = _parse_datetime(data["expires_at"])
    if "is_active" in data:
        promo.is_active = bool(data["is_active"])


# GET /api/v1/admin/promo-codes
@admin_promo_codes_bp.get("")
@role_required("admin")
def list_promo_codes():
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    q = PromoCode.query.order_by(PromoCode.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({"items": [p.to_dict() for p in items], "total": total, "page": page, "limit": limit}), 200


# POST /api/v1/admin/promo-codes
@admin_promo_codes_bp.post("")
@role_required("admin")
def create_promo_code():
    data = request.get_json(silent=True) or {}
    promo = PromoCode()
    try:
        _apply_fields(promo, data, is_create=True)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    db.session.add(promo)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": f"A promo code '{promo.code}' already exists."}), 409
    return jsonify(promo.to_dict()), 201


# PATCH /api/v1/admin/promo-codes/<int:promo_id>  — also used to deactivate (is_active: false)
@admin_promo_codes_bp.patch("/<int:promo_id>")
@role_required("admin")
def update_promo_code(promo_id):
    promo = PromoCode.query.get_or_404(promo_id)
    data = request.get_json(silent=True) or {}
    try:
        _apply_fields(promo, data, is_create=False)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": f"A promo code '{promo.code}' already exists."}), 409
    return jsonify(promo.to_dict()), 200


# DELETE /api/v1/admin/promo-codes/<int:promo_id>
@admin_promo_codes_bp.delete("/<int:promo_id>")
@role_required("admin")
def delete_promo_code(promo_id):
    promo = PromoCode.query.get_or_404(promo_id)
    if promo.used_count > 0:
        return jsonify({"error": "This code has already been redeemed — deactivate it instead of deleting."}), 400

    db.session.delete(promo)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Cannot delete a promo code that has been redeemed. Deactivate it instead."}), 400
    return jsonify({"message": "Promo code deleted."}), 200
