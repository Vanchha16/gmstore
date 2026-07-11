from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, text
from extensions import db
from models.product import Product
from models.review import Review

reviews_bp = Blueprint("reviews", __name__, url_prefix="/api/v1/products")

COMMENT_MAX_LEN = 1000


def _update_product_rating(product_id):
    stats = db.session.query(
        func.avg(Review.rating), func.count(Review.id)
    ).filter(Review.product_id == product_id).first()
    product = Product.query.get(product_id)
    if product:
        product.rating_avg = stats[0] or 0.0
        product.rating_count = stats[1] or 0
        db.session.commit()


@reviews_bp.get("/<int:product_id>/reviews")
def get_reviews(product_id):
    page = max(1, int(request.args.get("page", 1)))
    limit = min(max(1, int(request.args.get("limit", 10))), 50)
    Product.query.get_or_404(product_id)
    q = Review.query.filter_by(product_id=product_id).order_by(Review.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({"items": [r.to_dict() for r in items], "total": total, "page": page, "limit": limit}), 200


@reviews_bp.post("/<int:product_id>/reviews")
@jwt_required()
def add_review(product_id):
    user_id = int(get_jwt_identity())
    Product.query.get_or_404(product_id)

    data = request.get_json() or {}
    rating = data.get("rating")
    comment = (data.get("comment") or "").strip()

    if rating is None or not (1 <= int(rating) <= 5):
        return jsonify({"error": "Rating must be between 1 and 5."}), 400
    if len(comment) > COMMENT_MAX_LEN:
        return jsonify({"error": f"Comment must be {COMMENT_MAX_LEN} characters or fewer."}), 400

    if Review.query.filter_by(product_id=product_id, user_id=user_id).first():
        return jsonify({"error": "You have already reviewed this product."}), 409

    is_verified = False
    try:
        count = db.session.execute(
            text("SELECT COUNT(*) FROM order_items oi JOIN orders o ON oi.order_id=o.id "
                 "WHERE o.user_id=:u AND oi.product_id=:p AND o.status='fulfilled'"),
            {"u": user_id, "p": product_id}
        ).scalar()
        is_verified = (count or 0) > 0
    except Exception:
        pass

    review = Review(product_id=product_id, user_id=user_id,
                    rating=int(rating), comment=comment,
                    is_verified_purchase=is_verified)
    db.session.add(review)
    db.session.commit()
    _update_product_rating(product_id)
    return jsonify({"message": "Review submitted.", "review": review.to_dict()}), 201


@reviews_bp.patch("/<int:product_id>/reviews")
@jwt_required()
def edit_review(product_id):
    user_id = int(get_jwt_identity())
    review = Review.query.filter_by(product_id=product_id, user_id=user_id).first_or_404()

    data = request.get_json() or {}
    if "rating" in data:
        rating = int(data["rating"])
        if not (1 <= rating <= 5):
            return jsonify({"error": "Rating must be between 1 and 5."}), 400
        review.rating = rating
    if "comment" in data:
        comment = (data["comment"] or "").strip()
        if len(comment) > COMMENT_MAX_LEN:
            return jsonify({"error": f"Comment max {COMMENT_MAX_LEN} chars."}), 400
        review.comment = comment

    db.session.commit()
    _update_product_rating(product_id)
    return jsonify(review.to_dict()), 200


@reviews_bp.delete("/<int:product_id>/reviews")
@jwt_required()
def delete_review(product_id):
    user_id = int(get_jwt_identity())
    review = Review.query.filter_by(product_id=product_id, user_id=user_id).first_or_404()
    db.session.delete(review)
    db.session.commit()
    _update_product_rating(product_id)
    return jsonify({"message": "Review deleted."}), 200
