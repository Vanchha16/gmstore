from flask import Blueprint, jsonify, request
from models.contact_message import ContactMessage
from models.review import Review
from models.product import Product
from extensions import db
from utils.decorators import role_required
from sqlalchemy import func

admin_messages_bp = Blueprint("admin_messages", __name__, url_prefix="/api/v1/admin")


# ── Contact messages ─────────────────────────────────────────────────────────

@admin_messages_bp.get("/messages")
@role_required("admin")
def list_messages():
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    q = ContactMessage.query.order_by(ContactMessage.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({"items": [m.to_dict() for m in items], "total": total, "page": page, "limit": limit}), 200


@admin_messages_bp.get("/messages/unread-count")
@role_required("admin")
def unread_count():
    count = ContactMessage.query.filter_by(is_read=False).count()
    return jsonify({"unread": count}), 200


@admin_messages_bp.patch("/messages/<int:msg_id>/read")
@role_required("admin")
def mark_read(msg_id):
    msg = ContactMessage.query.get_or_404(msg_id)
    msg.is_read = True
    db.session.commit()
    return jsonify({"message": "Marked as read."}), 200


@admin_messages_bp.delete("/messages/<int:msg_id>")
@role_required("admin")
def delete_message(msg_id):
    msg = ContactMessage.query.get_or_404(msg_id)
    db.session.delete(msg)
    db.session.commit()
    return jsonify({"message": "Message deleted."}), 200


# ── Review moderation ─────────────────────────────────────────────────────────

@admin_messages_bp.get("/reviews")
@role_required("admin")
def list_reviews():
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    q = Review.query.order_by(Review.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({"items": [r.to_dict() for r in items], "total": total, "page": page, "limit": limit}), 200


@admin_messages_bp.delete("/reviews/<int:review_id>")
@role_required("admin")
def delete_review(review_id):
    review = Review.query.get_or_404(review_id)
    product_id = review.product_id
    db.session.delete(review)
    db.session.commit()
    # Recompute product rating
    stats = db.session.query(
        func.avg(Review.rating), func.count(Review.id)
    ).filter(Review.product_id == product_id).first()
    product = Product.query.get(product_id)
    if product:
        product.rating_avg = stats[0] or 0.0
        product.rating_count = stats[1] or 0
        db.session.commit()
    return jsonify({"message": "Review deleted."}), 200
