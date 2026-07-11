from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.wallet_topup import WalletTopup
from services.wallet_service import get_or_create_wallet, credit_wallet

wallet_bp = Blueprint("wallet", __name__, url_prefix="/api/v1/me/wallet")


@wallet_bp.get("")
@jwt_required()
def get_wallet():
    user_id = int(get_jwt_identity())
    wallet = get_or_create_wallet(user_id)
    db.session.commit()

    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    q = wallet.transactions
    total = q.count()
    transactions = q.offset((page - 1) * limit).limit(limit).all()

    return jsonify({
        "wallet": wallet.to_dict(),
        "transactions": [t.to_dict() for t in transactions],
        "total": total,
        "page": page,
        "limit": limit,
    }), 200


@wallet_bp.post("/topup")
@jwt_required()
def create_topup():
    from services.payway_service import create_bakong_qr_raw

    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    try:
        amount = float(data.get("amount"))
    except (TypeError, ValueError):
        return jsonify({"error": "A valid amount is required."}), 400

    if amount < 1:
        return jsonify({"error": "Minimum top-up is $1.00."}), 400
    if amount > 1000:
        return jsonify({"error": "Maximum top-up is $1000.00 per transaction."}), 400

    wallet = get_or_create_wallet(user_id)
    db.session.flush()

    topup = WalletTopup(wallet_id=wallet.id, amount=amount, currency=wallet.currency, provider="bakong")
    db.session.add(topup)
    db.session.flush()

    qr_data = create_bakong_qr_raw(amount, wallet.currency, f"TOPUP-{topup.id}")
    topup.qr_md5 = qr_data["qr_md5"]
    db.session.commit()

    return jsonify({
        "topup_id": topup.id,
        "qr_string": qr_data["qr_string"],
        "qr_md5": qr_data["qr_md5"],
        "amount": amount,
        "currency": wallet.currency,
    }), 201


@wallet_bp.get("/topup/<int:topup_id>/status")
@jwt_required()
def topup_status(topup_id):
    from services.payway_service import check_bakong_payment

    user_id = int(get_jwt_identity())
    wallet = get_or_create_wallet(user_id)
    db.session.commit()

    topup = WalletTopup.query.filter_by(id=topup_id, wallet_id=wallet.id).first_or_404()

    if topup.status == "pending" and topup.qr_md5:
        if check_bakong_payment(topup.qr_md5):
            _complete_topup(topup)

    return jsonify({"topup_id": topup.id, "status": topup.status}), 200


def _complete_topup(topup: WalletTopup) -> None:
    """Credit the wallet for a confirmed top-up. Idempotent — re-checks status inside."""
    from datetime import datetime, timezone

    fresh = WalletTopup.query.filter_by(id=topup.id).with_for_update().first()
    if not fresh or fresh.status != "pending":
        return
    credit_wallet(fresh.wallet.user_id, fresh.amount, type="topup",
                  reference=f"KHQR top-up #{fresh.id}")
    fresh.status = "success"
    fresh.completed_at = datetime.now(timezone.utc)
    db.session.commit()
