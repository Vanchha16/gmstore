from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.cart import Cart
from models.cart_item import CartItem
from models.product import Product
from services import promo_service

cart_bp = Blueprint("cart", __name__, url_prefix="/api/v1/cart")

# Purchasability never depends on real stock counts — the admin's manual is_available
# toggle gates whether a product can be bought at all. Still cap qty per line so a
# single order can't queue up an unbounded delivery commitment for the admin.
MAX_ON_DEMAND_QTY = 10


def get_or_create_active_cart(user_id):
    cart = Cart.query.filter_by(user_id=user_id, status="active").first()
    if not cart:
        cart = Cart(user_id=user_id, status="active")
        db.session.add(cart)
        db.session.commit()
    return cart


def _cart_response(cart, user_id):
    data = cart.to_dict()
    data["totals"] = promo_service.preview_cart_totals(cart, user_id)
    return data


@cart_bp.get("")
@jwt_required()
def get_cart():
    user_id = int(get_jwt_identity())
    cart = get_or_create_active_cart(user_id)
    return jsonify(_cart_response(cart, user_id)), 200


@cart_bp.post("/items")
@jwt_required()
def add_cart_item():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    product_id = data.get("product_id")
    qty = int(data.get("qty", 1))

    if not product_id or qty <= 0:
        return jsonify({"error": "Invalid product ID or quantity."}), 400

    product = Product.query.get_or_404(product_id)
    if product.status not in ("active", "coming_soon"):
        return jsonify({"error": "Product is not available for purchase."}), 400
    if product.status == "active" and not product.is_available:
        return jsonify({"error": "Product is currently not available for purchase."}), 400

    cart = get_or_create_active_cart(user_id)

    # Check if item already exists in cart
    item = CartItem.query.filter_by(cart_id=cart.id, product_id=product_id).first()
    target_qty = qty
    if item:
        target_qty += item.qty

    if product.status == "active" and target_qty > MAX_ON_DEMAND_QTY:
        return jsonify({"error": f"Max {MAX_ON_DEMAND_QTY} allowed per order."}), 400

    if item:
        item.qty = target_qty
        item.unit_price = product.price  # Update to latest price snapshot
    else:
        item = CartItem(
            cart_id=cart.id,
            product_id=product_id,
            unit_price=product.price,
            qty=qty
        )
        db.session.add(item)

    db.session.commit()
    return jsonify(_cart_response(cart, user_id)), 200


@cart_bp.patch("/items/<int:item_id>")
@jwt_required()
def update_cart_item(item_id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    qty = int(data.get("qty", 0))

    if qty <= 0:
        return jsonify({"error": "Quantity must be greater than zero."}), 400

    cart = get_or_create_active_cart(user_id)
    item = CartItem.query.filter_by(id=item_id, cart_id=cart.id).first_or_404()

    product = Product.query.get(item.product_id)
    if product and product.status == "active":
        if not product.is_available:
            return jsonify({"error": "Product is currently not available for purchase."}), 400
        if qty > MAX_ON_DEMAND_QTY:
            return jsonify({"error": f"Max {MAX_ON_DEMAND_QTY} allowed per order."}), 400

    item.qty = qty
    db.session.commit()
    return jsonify(_cart_response(cart, user_id)), 200


@cart_bp.delete("/items/<int:item_id>")
@jwt_required()
def delete_cart_item(item_id):
    user_id = int(get_jwt_identity())
    cart = get_or_create_active_cart(user_id)
    item = CartItem.query.filter_by(id=item_id, cart_id=cart.id).first_or_404()

    db.session.delete(item)
    db.session.commit()
    return jsonify(_cart_response(cart, user_id)), 200


# POST /api/v1/cart/apply-promo  — validates and stores the code on the cart for preview only.
# Not persisted to an order until checkout re-validates it inside the order transaction.
@cart_bp.post("/apply-promo")
@jwt_required()
def apply_promo():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    if not code:
        return jsonify({"error": "code is required."}), 400

    cart = get_or_create_active_cart(user_id)
    if not cart.items:
        return jsonify({"error": "Your cart is empty."}), 400

    promo = promo_service.find_active_code(code)
    if not promo:
        return jsonify({"error": "This promo code is not valid."}), 404

    subtotal = promo_service.cart_subtotal(cart)
    try:
        promo_service.validate_promo_code(promo, user_id, subtotal)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    cart.promo_code_id = promo.id
    db.session.commit()
    return jsonify(_cart_response(cart, user_id)), 200


# DELETE /api/v1/cart/apply-promo  — removes whatever code is currently applied.
@cart_bp.delete("/apply-promo")
@jwt_required()
def remove_promo():
    user_id = int(get_jwt_identity())
    cart = get_or_create_active_cart(user_id)
    cart.promo_code_id = None
    db.session.commit()
    return jsonify(_cart_response(cart, user_id)), 200
