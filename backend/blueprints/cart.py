from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.cart import Cart
from models.cart_item import CartItem
from models.product import Product

cart_bp = Blueprint("cart", __name__, url_prefix="/api/v1/cart")

# Active products can be bought even at 0 stock (admin sources it after payment —
# see reserve_or_await_stock / awaiting_stock flow). Still cap qty per line so a
# single order can't queue up an unbounded sourcing commitment for the admin.
MAX_ON_DEMAND_QTY = 10


def get_or_create_active_cart(user_id):
    cart = Cart.query.filter_by(user_id=user_id, status="active").first()
    if not cart:
        cart = Cart(user_id=user_id, status="active")
        db.session.add(cart)
        db.session.commit()
    return cart


@cart_bp.get("")
@jwt_required()
def get_cart():
    user_id = int(get_jwt_identity())
    cart = get_or_create_active_cart(user_id)
    return jsonify(cart.to_dict()), 200


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

    cart = get_or_create_active_cart(user_id)

    # Check if item already exists in cart
    item = CartItem.query.filter_by(cart_id=cart.id, product_id=product_id).first()
    target_qty = qty
    if item:
        target_qty += item.qty

    # Active products can be bought past available stock — admin sources the shortfall
    # after payment. Only the on-demand *overflow* is capped, not normal in-stock buys.
    if product.status == "active":
        available = product.available_stock
        if target_qty > available and target_qty > MAX_ON_DEMAND_QTY:
            return jsonify({
                "error": f"Only {available} in stock. Max {MAX_ON_DEMAND_QTY} allowed when sourcing on demand."
            }), 400

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
    return jsonify(cart.to_dict()), 200


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
        available = product.available_stock
        if qty > available and qty > MAX_ON_DEMAND_QTY:
            return jsonify({
                "error": f"Only {available} in stock. Max {MAX_ON_DEMAND_QTY} allowed when sourcing on demand."
            }), 400

    item.qty = qty
    db.session.commit()
    return jsonify(cart.to_dict()), 200


@cart_bp.delete("/items/<int:item_id>")
@jwt_required()
def delete_cart_item(item_id):
    user_id = int(get_jwt_identity())
    cart = get_or_create_active_cart(user_id)
    item = CartItem.query.filter_by(id=item_id, cart_id=cart.id).first_or_404()

    db.session.delete(item)
    db.session.commit()
    return jsonify(cart.to_dict()), 200
