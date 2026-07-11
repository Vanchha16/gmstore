from extensions import db
from models.order import Order


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


def cancel_order(order_id: int) -> "Order":
    """
    Cancel a pending_payment order and refund any wallet amount already debited.
    """
    order = Order.query.get(order_id)
    if not order:
        raise ValueError("Order not found.")
    if order.status != "pending_payment":
        raise ValueError(
            f"Cannot cancel — order status is '{order.status}'."
        )
    _refund_wallet_hold(order)
    order.status = "cancelled"
    db.session.commit()
    return order
