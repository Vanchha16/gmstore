from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.product import Product
from models.favorite import Favorite

favorites_bp = Blueprint("favorites", __name__, url_prefix="/api/v1/products")


@favorites_bp.post("/<int:product_id>/favorite")
@jwt_required()
def add_favorite(product_id):
    user_id = int(get_jwt_identity())
    product = Product.query.get_or_404(product_id)

    # Check if already favorited
    fav = Favorite.query.filter_by(user_id=user_id, product_id=product_id).first()
    if fav:
        return jsonify({"message": "Product already in favorites.", "id": fav.id}), 200

    new_fav = Favorite(user_id=user_id, product_id=product_id)
    db.session.add(new_fav)
    db.session.commit()

    return jsonify({"message": "Product added to favorites.", "id": new_fav.id}), 201


@favorites_bp.delete("/<int:product_id>/favorite")
@jwt_required()
def remove_favorite(product_id):
    user_id = int(get_jwt_identity())
    product = Product.query.get_or_404(product_id)

    fav = Favorite.query.filter_by(user_id=user_id, product_id=product_id).first()
    if not fav:
        return jsonify({"error": "Product not found in favorites."}), 404

    db.session.delete(fav)
    db.session.commit()

    return jsonify({"message": "Product removed from favorites."}), 200
