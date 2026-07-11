import random
from datetime import datetime, timezone
from decimal import Decimal
from extensions import db
from models.order import Order
from models.order_item import OrderItem
from models.cart import Cart
from models.payment import Payment
from models.product import Product
from models.stock_item import StockItem
from models.promo_code import PromoCode
from services import promo_service


def generate_order_number():
    date_str = datetime.now().strftime("%Y%m%d")
    rand_id = random.randint(100000, 999999)
    return f"GM-{date_str}-{rand_id}"


def create_order_from_cart(user_id, cart_id, payment_provider="mock", payment_method="khqr"):
    """
    Converts user's active cart into an Order and creates a Payment record.
    No stock_item is ever attached here — delivery is always a manual admin
    action (see deliver_order) performed after payment, regardless of whether
    stock happens to already exist for the product.
    Must be run inside a transaction.
    """
    cart = Cart.query.filter_by(id=cart_id, user_id=user_id, status="active").first()
    if not cart or not cart.items:
        raise ValueError("Shopping cart is empty or inactive.")

    # Calculate totals
    subtotal = Decimal(str(sum(float(item.unit_price) * item.qty for item in cart.items)))

    # Re-validate any applied promo code inside this same transaction — never trust
    # the discount the frontend showed at "apply" time, prices/usage may have changed since.
    promo = None
    discount = Decimal("0")
    if cart.promo_code_id:
        promo = PromoCode.query.filter_by(id=cart.promo_code_id).with_for_update().first()
        if not promo:
            raise ValueError("Your promo code is no longer available. Please remove it and try again.")
        try:
            promo_service.validate_promo_code(promo, user_id, subtotal)
        except ValueError as e:
            raise ValueError(f"Your promo code is no longer valid: {e}")
        discount = promo_service.compute_discount(promo, subtotal)

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
        promo_code_id=promo.id if promo else None,
        total=total,
        is_preorder=is_preorder
    )
    db.session.add(order)
    db.session.flush()  # gets the order.id

    # One OrderItem per unit so the admin Deliver popup can resolve (pick or
    # manually enter) exactly one credential per line, whatever the quantity bought.
    for item in cart.items:
        # coming_soon (preorder) lines stay a single row with the full qty — nothing
        # to deliver until the product goes active and it's re-purchased normally.
        per_unit_qty = item.qty if is_preorder else 1
        count = 1 if is_preorder else item.qty
        for _ in range(count):
            order_item = OrderItem(
                order_id=order.id,
                product_id=item.product_id,
                title_snapshot=item.product.title,
                unit_price=item.unit_price,
                qty=per_unit_qty,
                stock_item_id=None
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

    if promo:
        # Counts as "used" from checkout, not from payment — see promo_service.void_redemption_for_order
        # for how this gets rolled back if the order is later cancelled unpaid.
        promo_service.redeem_promo_code(promo, user_id, order.id, subtotal, discount)
        cart.promo_code_id = None

    # Mark cart as converted
    cart.status = "converted"
    db.session.commit()

    return order


def mark_order_paid(order_id, provider_txn_id, raw_response=None):
    """
    Marks an order as paid after payment confirmation — moves it into the
    "Pending Delivery" state. Never auto-attaches stock: admin always delivers
    manually via deliver_order, whether or not stock happens to already exist.
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

    order.status = "paid"  # "Pending Delivery" in the UI
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
    deliver via deliver_order, same as every other payment method.
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


def _validate_manual_payload(product_type: str, manual: dict) -> str:
    """Builds the raw secret_payload string from admin-typed fields, matching
    the same format rules as bulk stock upload (blueprints/admin/stock.py)."""
    if product_type == "account":
        username = (manual.get("username") or "").strip()
        password = (manual.get("password") or "").strip()
        if not username or not password:
            raise ValueError("Both username and password are required for an account product.")
        return f"{username}:{password}"
    elif product_type == "game_key":
        key = (manual.get("key") or "").strip()
        if not key:
            raise ValueError("A key is required for a game key product.")
        if ":" in key:
            raise ValueError("Game keys must not contain a colon ':' separator.")
        return key
    raise ValueError(f"Unknown product_type '{product_type}'.")


def deliver_order(order_id, resolutions):
    """
    Admin manually delivers a paid (pending-delivery) order. For every line item
    still missing a stock_item, `resolutions` must supply either an existing
    available stock_item to claim, or manually-typed credentials to create one
    on the spot. Both paths mark the stock item sold, assign it to the order line,
    then flip the order to fulfilled and send credentials to the buyer.

    resolutions: { order_item_id (int): {"stock_item_id": int} | {"manual": {...}} }
    """
    order = Order.query.get(order_id)
    if not order:
        raise ValueError("Order not found.")

    if order.status == "fulfilled":
        return order

    if order.status not in ("paid", "pending_payment"):
        raise ValueError(f"Cannot deliver order with status '{order.status}'.")

    unresolved = [item for item in order.items if item.stock_item_id is None]
    for item in unresolved:
        resolution = resolutions.get(item.id) or resolutions.get(str(item.id))
        if not resolution:
            raise ValueError(f"Missing delivery resolution for order item {item.id}.")

        if resolution.get("stock_item_id"):
            stock_item = (
                StockItem.query
                .filter_by(id=resolution["stock_item_id"])
                .with_for_update()
                .first()
            )
            if not stock_item or stock_item.product_id != item.product_id:
                raise ValueError(f"Stock item {resolution['stock_item_id']} does not belong to this product.")
            if stock_item.status != "available":
                raise ValueError(f"Stock item {stock_item.id} is no longer available.")
        elif resolution.get("manual"):
            from utils.security import encrypt_payload
            product = item.product
            payload = _validate_manual_payload(product.product_type, resolution["manual"])
            stock_item = StockItem(product_id=item.product_id, secret_payload=encrypt_payload(payload))
            db.session.add(stock_item)
            db.session.flush()
        else:
            raise ValueError(f"Resolution for order item {item.id} must include stock_item_id or manual credentials.")

        stock_item.status = "sold"
        stock_item.order_id = order.id
        item.stock_item_id = stock_item.id

        product = item.product
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
