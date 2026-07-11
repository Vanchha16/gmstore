import random
from datetime import datetime, timezone
from extensions import db
from models.order import Order
from models.order_item import OrderItem
from models.cart import Cart
from models.payment import Payment
from models.product import Product
from models.stock_item import StockItem
from services.inventory_service import reserve_stock


def generate_order_number():
    date_str = datetime.now().strftime("%Y%m%d")
    rand_id = random.randint(100000, 999999)
    return f"GM-{date_str}-{rand_id}"


def create_order_from_cart(user_id, cart_id, payment_provider="mock", payment_method="khqr"):
    """
    Converts user's active cart into an Order, reserves stock, and creates a Payment record.
    Must be run inside a transaction.
    """
    cart = Cart.query.filter_by(id=cart_id, user_id=user_id, status="active").first()
    if not cart or not cart.items:
        raise ValueError("Shopping cart is empty or inactive.")

    # Calculate totals
    subtotal = sum(float(item.unit_price) * item.qty for item in cart.items)
    discount = 0.0  # Placeholder for future promo codes
    total = subtotal - discount

    # Generate unique order number
    order_number = generate_order_number()

    # Determine if any items are pre-orders (status == coming_soon)
    is_preorder = any(item.product.status == "coming_soon" for item in cart.items)

    # Create the Order
    order = Order(
        order_number=order_number,
        user_id=user_id,
        status="pending_payment",
        subtotal=subtotal,
        discount=discount,
        total=total,
        is_preorder=is_preorder
    )
    db.session.add(order)
    db.session.flush()  # gets the order.id

    # Process and reserve stock items
    for item in cart.items:
        # Reserve stock (only if not pre-order, as coming_soon products don't have active stock)
        # Note: If it's a pre-order, we still create order_items but don't allocate stock items yet.
        reserved_items = []
        if not is_preorder:
            reserved_items = reserve_stock(item.product_id, item.qty)

        # Create Order Items
        if is_preorder:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                title_snapshot=item.product.title,
                unit_price=item.unit_price,
                qty=item.qty,
                stock_item_id=None
            )
            db.session.add(order_item)
        else:
            # We link each quantity to a specific reserved stock item
            for r_item in reserved_items:
                r_item.order_id = order.id  # Link stock item to order
                order_item = OrderItem(
                    order_id=order.id,
                    product_id=item.product_id,
                    title_snapshot=item.product.title,
                    unit_price=item.unit_price,
                    qty=1,  # Individual allocation per stock item
                    stock_item_id=r_item.id
                )
                db.session.add(order_item)

    # Create the Payment transaction record
    payment = Payment(
        order_id=order.id,
        provider=payment_provider,
        method=payment_method,
        amount=total,
        status="created"
    )
    db.session.add(payment)

    # Mark cart as converted
    cart.status = "converted"
    db.session.commit()

    return order


def mark_order_paid(order_id, provider_txn_id, raw_response=None):
    """
    Marks an order as paid after payment confirmation.
    Does NOT deliver credentials — admin must manually deliver via fulfill_order.
    """
    order = Order.query.get(order_id)
    if not order:
        raise ValueError("Order not found.")

    if order.status in ("paid", "fulfilled"):
        return order

    payment = Payment.query.filter_by(order_id=order_id).first()
    if payment:
        payment.status = "success"
        payment.provider_txn_id = provider_txn_id
        payment.raw_response = raw_response
        payment.updated_at = datetime.now(timezone.utc)

    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)
    db.session.commit()

    # Notify admin to process this order
    try:
        from flask import current_app
        print(f"[ORDER] mark_order_paid: MAIL_USERNAME={current_app.config.get('MAIL_USERNAME')!r} ADMIN_EMAIL={current_app.config.get('ADMIN_EMAIL')!r}", flush=True)
        from services.mail_service import send_order_paid_admin_notification, send_telegram_notification
        send_order_paid_admin_notification(order)
        send_telegram_notification(order)
        print(f"[ORDER] Admin notification call completed for {order.order_number}", flush=True)
    except Exception as e:
        import traceback
        print(f"[ORDER] Admin notification FAILED: {e}", flush=True)
        traceback.print_exc()

    return order


def check_and_fulfill_bakong_order(order_id: int) -> bool:
    """
    For a pending_payment order paid via Bakong KHQR, poll the provider and,
    if paid, mark it paid. Does NOT fulfill/deliver — admin must manually
    deliver via fulfill_order, same as every other payment method.
    Used both by the checkout polling endpoint and the scheduler fallback sweep,
    so the "paid" transition isn't dependent on the buyer's browser tab staying open.
    Returns True if this call just marked the order paid.
    """
    from services.payway_service import check_bakong_payment

    order = Order.query.get(order_id)
    if not order or order.status != "pending_payment":
        return False

    payment = Payment.query.filter_by(order_id=order_id).first()
    qr_md5 = (payment.raw_response or {}).get("qr_md5") if payment else None
    if not qr_md5:
        return False

    if not check_bakong_payment(qr_md5):
        return False

    mark_order_paid(
        order_id,
        provider_txn_id=f"BAKONG-{qr_md5[:16]}",
        raw_response={"bakong_md5": qr_md5},
    )
    return True


def fulfill_order(order_id, provider_txn_id=None, raw_response=None):
    """
    Admin manually fulfills a paid order: marks stock as sold, sends credentials to buyer.
    """
    order = Order.query.get(order_id)
    if not order:
        raise ValueError("Order not found.")

    if order.status == "fulfilled":
        return order

    if order.status not in ("paid", "pending_payment"):
        raise ValueError(f"Cannot fulfill order with status '{order.status}'.")

    # If payment wasn't recorded yet (e.g. manual admin override), record it now
    if provider_txn_id:
        payment = Payment.query.filter_by(order_id=order_id).first()
        if payment and not payment.provider_txn_id:
            payment.status = "success"
            payment.provider_txn_id = provider_txn_id
            payment.raw_response = raw_response
            payment.updated_at = datetime.now(timezone.utc)

    # Mark stock items as sold and increment product sales counts
    for item in order.items:
        if item.stock_item:
            item.stock_item.status = "sold"
            item.stock_item.reserved_until = None
            product = Product.query.get(item.product_id)
            if product:
                product.sold_count += 1

    if not order.paid_at:
        order.paid_at = datetime.now(timezone.utc)
    order.status = "fulfilled"
    order.fulfilled_at = datetime.now(timezone.utc)
    db.session.commit()

    # Send credentials to buyer (email + Telegram if buyer is a tg_ user)
    try:
        from services.mail_service import send_delivery_email, send_telegram_delivery
        send_delivery_email(order)
        send_telegram_delivery(order)
    except Exception as e:
        print(f"Error sending delivery: {e}")

    return order
