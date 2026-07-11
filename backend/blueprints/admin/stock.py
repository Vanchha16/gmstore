from flask import Blueprint, request, jsonify
from extensions import db
from models.product import Product
from models.stock_item import StockItem
from utils.decorators import role_required
from utils.security import encrypt_payload

admin_stock_bp = Blueprint("admin_stock", __name__, url_prefix="/api/v1/admin/products")


# GET /api/v1/admin/products/<int:product_id>/awaiting-count
@admin_stock_bp.get("/<int:product_id>/awaiting-count")
@role_required("admin")
def get_awaiting_count(product_id):
    """Number of unlinked order lines (across awaiting_stock orders) still needing this product sourced."""
    from models.order import Order
    from models.order_item import OrderItem
    count = (
        OrderItem.query
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            OrderItem.product_id == product_id,
            OrderItem.stock_item_id.is_(None),
            Order.status == "awaiting_stock",
        )
        .count()
    )
    return jsonify({"count": count}), 200


# POST /api/v1/admin/products/<int:product_id>/stock  — bulk add
@admin_stock_bp.post("/<int:product_id>/stock")
@role_required("admin")
def add_stock(product_id):
    product = Product.query.filter_by(id=product_id, deleted_at=None).first_or_404()
    data = request.get_json(silent=True) or {}
    payloads = data.get("payloads", [])
    if not payloads or not isinstance(payloads, list):
        return jsonify({"error": "payloads must be a non-empty list of strings."}), 400

    items = []
    for raw in payloads:
        if not isinstance(raw, str):
            continue
        val = raw.strip()
        if not val:
            continue
            
        # Format validations
        if product.product_type == "account":
            if ":" not in val:
                return jsonify({"error": f"Format error for '{val}'. Account products must be in 'username:password' format."}), 400
        elif product.product_type == "game_key":
            if ":" in val:
                return jsonify({"error": f"Format error for '{val}'. Game keys must not contain a colon ':' separator."}), 400

        item = StockItem(product_id=product_id, secret_payload=encrypt_payload(val))
        db.session.add(item)
        items.append(item)

    db.session.commit()

    resolved = 0
    if items:
        from services.inventory_service import try_fulfill_awaiting_orders
        resolved = try_fulfill_awaiting_orders(product_id)

    message = f"Successfully added {len(items)} stock items."
    if resolved:
        message += f" Auto-fulfilled {resolved} order(s) that were awaiting stock."
    return jsonify({"added": len(items), "orders_resolved": resolved, "message": message}), 201


# GET /api/v1/admin/products/<int:product_id>/stock
@admin_stock_bp.get("/<int:product_id>/stock")
@role_required("admin")
def list_stock(product_id):
    Product.query.filter_by(id=product_id, deleted_at=None).first_or_404()
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 50)), 200)
    status = request.args.get("status")

    q = StockItem.query.filter_by(product_id=product_id)
    if status:
        q = q.filter_by(status=status)
    q = q.order_by(StockItem.created_at.desc())

    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    
    # reveal=True decrypts credentials for administrative review
    return jsonify({
        "items": [i.to_dict(reveal=True) for i in items],
        "total": total,
        "page": page,
        "limit": limit,
    }), 200


# PATCH /api/v1/admin/products/stock/<int:item_id>
@admin_stock_bp.patch("/stock/<int:item_id>")
@role_required("admin")
def update_stock_item(item_id):
    item = StockItem.query.get_or_404(item_id)
    if item.status != "available":
        return jsonify({"error": "Only available stock items can be edited."}), 400

    data = request.get_json(silent=True) or {}
    new_payload = data.get("secret_payload", "").strip()
    if not new_payload:
        return jsonify({"error": "secret_payload cannot be empty."}), 400

    product = item.product
    
    # Format validations
    if product.product_type == "account":
        if ":" not in new_payload:
            return jsonify({"error": "Account credentials must be in 'username:password' format."}), 400
    elif product.product_type == "game_key":
        if ":" in new_payload:
            return jsonify({"error": "Game keys must not contain a colon ':' separator."}), 400

    item.secret_payload = encrypt_payload(new_payload)
    db.session.commit()
    
    return jsonify(item.to_dict(reveal=True)), 200


# DELETE /api/v1/admin/stock/<int:item_id>
@admin_stock_bp.delete("/stock/<int:item_id>")
@role_required("admin")
def delete_stock_item(item_id):
    item = StockItem.query.get_or_404(item_id)
    if item.status != "available":
        return jsonify({"error": "Only available items can be deleted."}), 400
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Stock item deleted."}), 200


# POST /api/v1/admin/stock/<int:item_id>/release  — force-release a reserved item
@admin_stock_bp.post("/stock/<int:item_id>/release")
@role_required("admin")
def force_release_stock(item_id):
    item = StockItem.query.get_or_404(item_id)
    if item.status != "reserved":
        return jsonify({"error": "Only reserved items can be force-released."}), 400
    from models.order_item import OrderItem
    item.status = "available"
    item.reserved_until = None
    item.order_id = None
    OrderItem.query.filter_by(stock_item_id=item_id).update({"stock_item_id": None}, synchronize_session="fetch")
    db.session.commit()
    return jsonify({"message": "Stock item released back to available.", "item": item.to_dict()}), 200
