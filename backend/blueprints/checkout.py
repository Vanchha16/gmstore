import random
from decimal import Decimal
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.order import Order
from models.cart import Cart
from services.order_service import create_order_from_cart, mark_order_paid, check_and_fulfill_bakong_order
from services.payway_service import get_payment_details
from services.inventory_service import release_order_stock, _refund_wallet_hold
from services.wallet_service import get_or_create_wallet, debit_wallet

checkout_bp = Blueprint("checkout", __name__, url_prefix="/api/v1")


@checkout_bp.post("/checkout")
@jwt_required()
def checkout():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    method = data.get("method", "khqr")
    use_wallet = bool(data.get("use_wallet"))

    if method not in ("khqr", "abapay", "card", "wallet"):
        return jsonify({"error": "Invalid payment method."}), 400

    cart = Cart.query.filter_by(user_id=user_id, status="active").first()
    if not cart or not cart.items:
        return jsonify({"error": "Your cart is empty."}), 400

    # Release stock from any previous pending_payment orders so the same
    # items don't stay locked if the user abandoned an earlier QR page.
    stale = Order.query.filter_by(user_id=user_id, status="pending_payment").all()
    for old in stale:
        release_order_stock(old.id)
        _refund_wallet_hold(old)
        old.status = "cancelled"
    if stale:
        db.session.commit()

    try:
        if method == "wallet":
            order = create_order_from_cart(
                user_id, cart.id,
                payment_provider="wallet",
                payment_method="wallet",
            )
            try:
                debit_wallet(user_id, order.total, type="purchase",
                              order_id=order.id, reference=order.order_number)
            except ValueError as e:
                release_order_stock(order.id)
                order.status = "cancelled"
                db.session.commit()
                return jsonify({"error": str(e)}), 400
            order.wallet_amount = order.total
            db.session.commit()
            mark_order_paid(order.id, provider_txn_id=f"WALLET-{order.order_number}",
                             raw_response={"source": "wallet"})
            db.session.refresh(order)
            return jsonify({"order": order.to_dict(), "payment_details": None}), 201

        order = create_order_from_cart(
            user_id, cart.id,
            payment_provider="bakong",
            payment_method=method,
        )

        wallet_apply = Decimal("0")
        if use_wallet:
            wallet = get_or_create_wallet(user_id)
            wallet_apply = min(Decimal(wallet.balance), Decimal(order.total))
            if wallet_apply > 0:
                debit_wallet(user_id, wallet_apply, type="purchase",
                             order_id=order.id, reference=order.order_number)
                order.wallet_amount = wallet_apply
                db.session.commit()

        remainder = Decimal(order.total) - wallet_apply
        if remainder <= 0:
            payment = order.payments[0] if order.payments else None
            if payment:
                payment.provider = "wallet"
                payment.method = "wallet"
                payment.amount = order.total
                db.session.commit()
            mark_order_paid(order.id, provider_txn_id=f"WALLET-{order.order_number}",
                             raw_response={"source": "wallet"})
            db.session.refresh(order)
            return jsonify({"order": order.to_dict(), "payment_details": None}), 201

        pay_details = get_payment_details(order, amount_due=remainder)
        return jsonify({"order": order.to_dict(), "payment_details": pay_details}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Checkout failed: {str(e)}"}), 500


@checkout_bp.get("/orders/<int:order_id>/payment-status")
@jwt_required()
def payment_status(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()

    if order.status == "pending_payment":
        try:
            if check_and_fulfill_bakong_order(order.id):
                db.session.refresh(order)
        except Exception as exc:
            from flask import current_app
            current_app.logger.error("check_and_fulfill_bakong_order failed: %s", exc)

    return jsonify({
        "order_id": order.id,
        "status": order.status,
        "is_preorder": order.is_preorder,
    }), 200


@checkout_bp.post("/payment/mock/pay")
@jwt_required()
def mock_pay():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    order_id = data.get("order_id")

    if not order_id:
        return jsonify({"error": "order_id is required."}), 400

    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    if order.status != "pending_payment":
        return jsonify({"error": f"Order is already '{order.status}'."}), 400

    try:
        txn_ref = f"MOCK-TXN-{random.randint(10000000, 99999999)}"
        paid = mark_order_paid(order.id, provider_txn_id=txn_ref, raw_response={"simulation": "success"})
        return jsonify({"message": "Mock payment successful. Awaiting admin delivery.", "order": paid.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Simulation failed: {str(e)}"}), 500


@checkout_bp.post("/orders/<int:order_id>/cancel")
@jwt_required()
def cancel_order_route(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()

    if order.status != "pending_payment":
        return jsonify({"error": "Only pending_payment orders can be cancelled."}), 400

    try:
        released = release_order_stock(order.id)
        _refund_wallet_hold(order)
        order.status = "cancelled"

        # Restore cart so user can try again immediately
        cart = Cart.query.filter_by(user_id=user_id, status="converted").order_by(Cart.id.desc()).first()
        if cart:
            cart.status = "active"

        db.session.commit()
        return jsonify({
            "message": f"Order cancelled. {released} stock item(s) released.",
            "order_id": order.id,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Cancel failed: {str(e)}"}), 500
