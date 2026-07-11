from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.product import Product
from models.preorder import Preorder

preorders_bp = Blueprint("preorders", __name__, url_prefix="/api/v1/products")


@preorders_bp.post("/<int:product_id>/preorder")
@jwt_required()
def add_preorder(product_id):
    user_id = int(get_jwt_identity())
    product = Product.query.get_or_404(product_id)

    # Preorders are only allowed on coming_soon status products
    if product.status != "coming_soon":
        return jsonify({"error": "This product is not available for pre-order."}), 400

    existing = Preorder.query.filter_by(user_id=user_id, product_id=product_id).first()
    if existing:
        if existing.status == "cancelled":
            existing.status = "waiting"
            db.session.commit()
            return jsonify({"message": "Pre-order reactivated successfully.", "id": existing.id}), 200
        return jsonify({"message": "You have already pre-ordered this product.", "id": existing.id}), 200

    new_preorder = Preorder(user_id=user_id, product_id=product_id, status="waiting")
    db.session.add(new_preorder)
    db.session.commit()

    return jsonify({"message": "Product pre-ordered successfully.", "id": new_preorder.id}), 201


@preorders_bp.delete("/<int:product_id>/preorder")
@jwt_required()
def cancel_preorder(product_id):
    user_id = int(get_jwt_identity())
    product = Product.query.get_or_404(product_id)

    preorder = Preorder.query.filter_by(user_id=user_id, product_id=product_id).first()
    if not preorder:
        return jsonify({"error": "Pre-order not found."}), 404

    # We can either delete it or mark it cancelled. Marking it cancelled is better for tracking/auditing
    preorder.status = "cancelled"
    db.session.commit()

    return jsonify({"message": "Pre-order cancelled successfully."}), 200
