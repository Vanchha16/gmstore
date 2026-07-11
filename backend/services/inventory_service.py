from datetime import datetime, timedelta
from extensions import db
from models.stock_item import StockItem
from models.order import Order
from models.order_item import OrderItem


def _refund_wallet_hold(order: "Order") -> None:
    """If part of this order was already debited from the buyer's wallet, credit it back."""
    if not order.wallet_amount or order.wallet_amount <= 0:
        return
    from services.wallet_service import credit_wallet
    credit_wallet(
        order.user_id, order.wallet_amount, type="refund",
        order_id=order.id, reference=f"Cancelled order {order.order_number}",
    )
    order.wallet_amount = 0


def reserve_stock(product_id: int, qty: int, hold_minutes: int = 15) -> list:
    """
    Pessimistically lock and reserve `qty` available stock items.
    Must be called inside an active DB transaction (caller commits).
    """
    items = (
        StockItem.query
        .filter_by(product_id=product_id, status="available")
        .with_for_update()
        .limit(qty)
        .all()
    )
    if len(items) < qty:
        raise ValueError(
            f"Not enough stock for product {product_id}. "
            f"Available: {len(items)}, requested: {qty}."
        )
    until = datetime.utcnow() + timedelta(minutes=hold_minutes)
    for item in items:
        item.status = "reserved"
        item.reserved_until = until
    return items


def release_order_stock(order_id: int) -> int:
    """
    Release all reserved stock items for a single order back to available.
    Also NULLs order_item.stock_item_id so no dangling FK remains.
    Caller must commit.
    """
    items = StockItem.query.filter_by(order_id=order_id, status="reserved").all()
    for item in items:
        item.status = "available"
        item.reserved_until = None
        item.order_id = None

    if items:
        (
            OrderItem.query
            .filter_by(order_id=order_id)
            .update({"stock_item_id": None}, synchronize_session="fetch")
        )
    return len(items)


def cancel_order(order_id: int) -> "Order":
    """
    Cancel a pending_payment order and release its reserved stock.
    """
    order = Order.query.get(order_id)
    if not order:
        raise ValueError("Order not found.")
    if order.status != "pending_payment":
        raise ValueError(
            f"Cannot cancel — order status is '{order.status}'."
        )
    release_order_stock(order_id)
    _refund_wallet_hold(order)
    order.status = "cancelled"
    db.session.commit()
    return order


def release_stale_reservations() -> int:
    """
    APScheduler job: expire held stock and cancel the associated orders.
    Uses naive UTC throughout to match what pymysql stores in DATETIME columns.
    """
    now = datetime.utcnow()
    stale = StockItem.query.filter(
        StockItem.status == "reserved",
        StockItem.reserved_until < now,
    ).all()

    if not stale:
        return 0

    order_ids = {item.order_id for item in stale if item.order_id}

    for item in stale:
        item.status = "available"
        item.reserved_until = None
        item.order_id = None

    # Null out the dangling stock_item_id from order_items
    if order_ids:
        (
            OrderItem.query
            .filter(OrderItem.order_id.in_(order_ids))
            .update({"stock_item_id": None}, synchronize_session="fetch")
        )
        expiring_orders = (
            Order.query
            .filter(Order.id.in_(order_ids), Order.status == "pending_payment")
            .all()
        )
        for order in expiring_orders:
            _refund_wallet_hold(order)
            order.status = "cancelled"

    db.session.commit()
    return len(stale)
