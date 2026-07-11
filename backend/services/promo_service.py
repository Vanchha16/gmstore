from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from extensions import db
from models.promo_code import PromoCode
from models.promo_code_redemption import PromoCodeRedemption


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _now_naive():
    # Matches how pymysql stores/reads naive UTC DATETIME columns elsewhere in this project.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def find_active_code(code: str) -> "PromoCode | None":
    if not code:
        return None
    return PromoCode.query.filter_by(code=code.strip().upper()).first()


def validate_promo_code(promo: "PromoCode", user_id: int, subtotal: Decimal) -> None:
    """Raises ValueError with a buyer-facing message if the code can't be applied right now."""
    if not promo or not promo.is_active:
        raise ValueError("This promo code is not valid.")

    now = _now_naive()
    if promo.starts_at and now < promo.starts_at:
        raise ValueError("This promo code is not active yet.")
    if promo.expires_at and now > promo.expires_at:
        raise ValueError("This promo code has expired.")

    if promo.min_order_amount is not None and subtotal < Decimal(promo.min_order_amount):
        raise ValueError(f"This promo code requires a minimum order of ${float(promo.min_order_amount):.2f}.")

    if promo.max_uses is not None and promo.used_count >= promo.max_uses:
        raise ValueError("This promo code has reached its usage limit.")

    if promo.max_uses_per_user is not None:
        used_by_user = PromoCodeRedemption.query.filter_by(promo_code_id=promo.id, user_id=user_id).count()
        if used_by_user >= promo.max_uses_per_user:
            raise ValueError("You've already used this promo code the maximum number of times.")


def compute_discount(promo: "PromoCode", subtotal: Decimal) -> Decimal:
    subtotal = Decimal(subtotal)
    value = Decimal(promo.discount_value)
    if promo.discount_type == "percent":
        discount = subtotal * value / Decimal("100")
    else:
        discount = value
    # Never let a discount exceed the order, or go negative.
    discount = max(Decimal("0"), min(discount, subtotal))
    return _round2(discount)


def cart_subtotal(cart) -> Decimal:
    return _round2(sum((Decimal(item.unit_price) * item.qty for item in cart.items), Decimal("0")))


def preview_cart_totals(cart, user_id: int) -> dict:
    """Best-effort computation for display (GET /cart, apply-promo response).
    Never mutates state — checkout re-validates and redeems for real."""
    subtotal = cart_subtotal(cart)
    result = {
        "subtotal": float(subtotal),
        "discount": 0.0,
        "total": float(subtotal),
        "promo_code": None,
        "promo_error": None,
    }
    if not cart.promo_code_id:
        return result

    promo = PromoCode.query.get(cart.promo_code_id)
    result["promo_code"] = promo.summary_dict() if promo else None
    try:
        validate_promo_code(promo, user_id, subtotal)
    except ValueError as e:
        result["promo_error"] = str(e)
        return result

    discount = compute_discount(promo, subtotal)
    result["discount"] = float(discount)
    result["total"] = float(subtotal - discount)
    return result


def redeem_promo_code(promo: "PromoCode", user_id: int, order_id: int, subtotal: Decimal, discount_amount: Decimal) -> None:
    """Locks the promo row, re-validates, and records the redemption. Caller commits.
    Must run inside the same transaction as order creation."""
    locked = PromoCode.query.filter_by(id=promo.id).with_for_update().first()
    validate_promo_code(locked, user_id, subtotal)  # re-check usage limits under the lock
    locked.used_count += 1
    db.session.add(PromoCodeRedemption(
        promo_code_id=locked.id,
        user_id=user_id,
        order_id=order_id,
        discount_amount=discount_amount,
    ))


def void_redemption_for_order(order) -> None:
    """Called whenever an order is cancelled before delivery — frees the code for reuse."""
    redemption = PromoCodeRedemption.query.filter_by(order_id=order.id).first()
    if not redemption:
        return
    promo = PromoCode.query.filter_by(id=redemption.promo_code_id).with_for_update().first()
    if promo and promo.used_count > 0:
        promo.used_count -= 1
    db.session.delete(redemption)
