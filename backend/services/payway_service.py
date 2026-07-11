import hashlib
import hmac
import base64
from datetime import datetime
from flask import current_app
from bakong_khqr import KHQR


def _sdk() -> KHQR:
    token = current_app.config.get("BAKONG_TOKEN", "")
    return KHQR(token)


# ---------------------------------------------------------------------------
# Bakong KHQR — official SDK
# ---------------------------------------------------------------------------

def create_bakong_qr_raw(amount: float, currency: str, bill_number: str) -> dict:
    """
    Generate a Bakong KHQR for an arbitrary amount/bill reference via the official SDK.
    Returns a dict with qr_string and qr_md5.
    The MD5 must be stored and reused for every status poll — do NOT regenerate.
    """
    bakong_id = current_app.config.get("BAKONG_ACCOUNT_ID", "loum_vanchha@bkrt")
    khqr = _sdk()

    qr_string = khqr.create_qr(
        account_id=bakong_id,
        merchant_name="GM Store",
        merchant_city="Phnom Penh",
        amount=float(amount),
        currency=currency or "USD",
        country_code="KH",
        bill_number=bill_number,
        store_label="GM Store",
        expiration=1,   # 1 hour
    )
    qr_md5 = khqr.generate_md5(qr_string)
    return {"qr_string": qr_string, "qr_md5": qr_md5}


def create_bakong_qr(order) -> dict:
    """Generate a Bakong KHQR for an order's total. See create_bakong_qr_raw."""
    return create_bakong_qr_raw(float(order.total), order.currency or "USD", order.order_number)


def check_bakong_payment(qr_md5: str) -> bool:
    """
    Returns True if the Bakong transaction for this QR MD5 has been paid.
    """
    try:
        status = _sdk().check_payment(qr_md5)
        return str(status).upper() == "PAID"
    except Exception as exc:
        current_app.logger.warning("Bakong check_payment error: %s", exc)
        return False


def get_payment_details(order, amount_due=None) -> dict:
    """
    Build the full payment payload for the checkout response.
    Stores the QR MD5 in the order's Payment.raw_response for later polling.
    `amount_due` overrides the QR amount (used when part of the order was
    already covered by wallet balance, so only the remainder is charged).
    """
    from models.payment import Payment
    from extensions import db

    charge_amount = float(amount_due) if amount_due is not None else float(order.total)
    qr_data = create_bakong_qr_raw(charge_amount, order.currency or "USD", order.order_number)

    # Persist the MD5 into the payment row so we can poll with it later
    payment = Payment.query.filter_by(order_id=order.id).first()
    if payment:
        payment.amount = charge_amount
        payment.raw_response = {"qr_md5": qr_data["qr_md5"], "qr_string": qr_data["qr_string"]}
        db.session.commit()

    return {
        "provider": "bakong",
        "method": "khqr",
        "qr_string": qr_data["qr_string"],
        "qr_md5": qr_data["qr_md5"],
        "amount": charge_amount,
        "currency": order.currency or "USD",
        "order_number": order.order_number,
        "order_id": order.id,
    }


# ---------------------------------------------------------------------------
# ABA PayWay (used only when PAYMENT_PROVIDER=payway in Phase 6)
# ---------------------------------------------------------------------------

def _hmac_sha512_b64(secret: str, message: str) -> str:
    dig = hmac.new(secret.encode(), message.encode(), hashlib.sha512).digest()
    return base64.b64encode(dig).decode()


def verify_callback_signature(payload: dict, signature: str) -> bool:
    provider = current_app.config.get("PAYMENT_PROVIDER", "mock")
    if provider == "mock":
        return True
    api_key = current_app.config.get("PAYWAY_API_KEY", "")
    try:
        raw = f"{payload.get('tran_id')}{payload.get('status')}{payload.get('amount')}"
        return hmac.compare_digest(_hmac_sha512_b64(api_key, raw), signature)
    except Exception:
        return False
