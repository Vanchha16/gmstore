from flask import Blueprint, request, jsonify
from extensions import db
from models.order import Order
from models.payment import Payment
from models.stock_item import StockItem
from utils.decorators import role_required
from services.order_service import deliver_order
from services.wallet_service import credit_wallet

admin_orders_bp = Blueprint("admin_orders", __name__, url_prefix="/api/v1/admin/orders")


# GET /api/v1/admin/orders
@admin_orders_bp.get("")
@role_required("admin")
def list_orders():
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    status = request.args.get("status", "").strip()
    q_str = request.args.get("q", "").strip()

    q = Order.query
    if status:
        q = q.filter(Order.status == status)
    if q_str:
        q = q.filter(Order.order_number.ilike(f"%{q_str}%"))
    q = q.order_by(Order.created_at.desc())

    total = q.count()
    orders = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({
        "items": [o.to_dict() for o in orders],
        "total": total,
        "page": page,
        "limit": limit,
    }), 200


# GET /api/v1/admin/orders/deliver-count
@admin_orders_bp.get("/deliver-count")
@role_required("admin")
def get_deliver_count():
    count = Order.query.filter_by(status="paid").count()
    return jsonify({"count": count}), 200


# GET /api/v1/admin/orders/<int:order_id>
@admin_orders_bp.get("/<int:order_id>")
@role_required("admin")
def get_order(order_id):
    order = Order.query.get_or_404(order_id)
    return jsonify(order.to_dict()), 200


# PATCH /api/v1/admin/orders/<int:order_id>  — manual status override
@admin_orders_bp.patch("/<int:order_id>")
@role_required("admin")
def update_order(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    allowed = {"pending_payment", "paid", "fulfilled", "cancelled", "refunded", "failed"}
    if new_status and new_status not in allowed:
        return jsonify({"error": f"Invalid status '{new_status}'."}), 400

    if new_status:
        order.status = new_status

    db.session.commit()
    return jsonify(order.to_dict()), 200


# GET /api/v1/admin/orders/<int:order_id>/deliverable
@admin_orders_bp.get("/<int:order_id>/deliverable")
@role_required("admin")
def get_deliverable(order_id):
    """What the admin Deliver popup needs: the order, plus for every line still
    missing a stock_item, the pool of available (unassigned) stock for that product
    so the admin can pick one, or fall back to typing credentials in manually."""
    order = Order.query.get_or_404(order_id)
    unresolved = [item for item in order.items if item.stock_item_id is None]

    options_by_item = {}
    for item in unresolved:
        available = (
            StockItem.query
            .filter_by(product_id=item.product_id, status="available")
            .order_by(StockItem.created_at.asc())
            .all()
        )
        options_by_item[item.id] = {
            "product_type": item.product.product_type if item.product else None,
            "available_stock": [{"id": s.id, "created_at": s.created_at.isoformat()} for s in available],
        }

    return jsonify({"order": order.to_dict(), "items_needing_delivery": options_by_item}), 200


# POST /api/v1/admin/orders/<int:order_id>/deliver
@admin_orders_bp.post("/<int:order_id>/deliver")
@role_required("admin")
def deliver_order_route(order_id):
    order = Order.query.get_or_404(order_id)
    if order.status == "fulfilled":
        return jsonify({"error": "Order is already fulfilled."}), 400
    if order.status not in ("paid", "pending_payment"):
        return jsonify({"error": f"Cannot deliver order with status '{order.status}'."}), 400

    data = request.get_json(silent=True) or {}
    raw_resolutions = data.get("resolutions") or {}
    # Body keys arrive as strings over JSON — normalize to int order_item_id.
    resolutions = {int(k): v for k, v in raw_resolutions.items()}

    try:
        fulfilled = deliver_order(order_id, resolutions)
        return jsonify({"message": "Order delivered successfully.", "order": fulfilled.to_dict()}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Delivery failed: {str(e)}"}), 500


# POST /api/v1/admin/orders/<int:order_id>/refund
@admin_orders_bp.post("/<int:order_id>/refund")
@role_required("admin")
def refund_order(order_id):
    order = Order.query.get_or_404(order_id)
    if order.delivery_confirmed:
        return jsonify({"error": "Cannot refund an order after delivery is confirmed."}), 400
    if order.status not in ("paid", "fulfilled"):
        return jsonify({"error": "Only paid or fulfilled orders can be refunded."}), 400

    order.status = "refunded"
    payment = Payment.query.filter_by(order_id=order_id).first()
    if payment:
        payment.status = "refunded"

    credit_wallet(order.user_id, order.total, type="refund",
                  order_id=order.id, reference=f"Refund for order {order.order_number}")

    db.session.commit()
    return jsonify({"message": "Order refunded to buyer's wallet.", "order": order.to_dict()}), 200
