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


def reserve_or_await_stock(product_id: int, qty: int, hold_minutes: int = 15) -> tuple:
    """
    Like reserve_stock, but never raises on shortage: reserves whatever's available
    (0..qty) and returns (reserved_items, missing_qty) so the caller can create
    stock-less order lines for the shortfall (awaiting_stock flow).
    Must be called inside an active DB transaction (caller commits).
    """
    items = (
        StockItem.query
        .filter_by(product_id=product_id, status="available")
        .with_for_update()
        .limit(qty)
        .all()
    )
    until = datetime.utcnow() + timedelta(minutes=hold_minutes)
    for item in items:
        item.status = "reserved"
        item.reserved_until = until
    return items, qty - len(items)


def try_fulfill_awaiting_orders(product_id: int) -> int:
    """
    Called after admin adds new stock for a product. FIFO-claims newly available
    stock items for awaiting_stock orders' unlinked lines (oldest order first).
    Flips an order to 'paid' once every line has stock attached.
    Returns the number of orders that were fully resolved (flipped to paid).
    """
    from models.product import Product

    unresolved_items = (
        OrderItem.query
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            OrderItem.product_id == product_id,
            OrderItem.stock_item_id.is_(None),
            Order.status == "awaiting_stock",
        )
        .order_by(Order.created_at.asc())
        .all()
    )
    if not unresolved_items:
        return 0

    resolved_order_ids = set()
    for oi in unresolved_items:
        claimed = (
            StockItem.query
            .filter_by(product_id=product_id, status="available")
            .with_for_update()
            .limit(1)
            .first()
        )
        if not claimed:
            break  # out of fresh stock — remaining orders stay awaiting_stock
        claimed.status = "reserved"
        claimed.order_id = oi.order_id
        claimed.reserved_until = None  # already-paid order — not subject to the stale-hold sweep
        oi.stock_item_id = claimed.id

    db.session.flush()

    touched_order_ids = {oi.order_id for oi in unresolved_items}
    for order_id in touched_order_ids:
        order = Order.query.get(order_id)
        if order and order.status == "awaiting_stock" and not order.needs_sourcing:
            order.status = "paid"
            resolved_order_ids.add(order_id)
            try:
                from services.mail_service import send_stock_ready_notification
                send_stock_ready_notification(order)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning("Stock-ready notify failed for order %s: %s", order_id, exc)

    db.session.commit()
    return len(resolved_order_ids)


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
