from flask import Blueprint, request, jsonify
from extensions import db
from models.user import User
from models.wallet import Wallet
from utils.decorators import role_required
from services.wallet_service import get_or_create_wallet, credit_wallet, debit_wallet

admin_wallets_bp = Blueprint("admin_wallets", __name__, url_prefix="/api/v1/admin/wallets")


# GET /api/v1/admin/wallets
@admin_wallets_bp.get("")
@role_required("admin")
def list_wallets():
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    q_str = request.args.get("q", "").strip()

    q = db.session.query(Wallet, User).join(User, Wallet.user_id == User.id)
    if q_str:
        q = q.filter(
            db.or_(
                User.email.ilike(f"%{q_str}%"),
                User.full_name.ilike(f"%{q_str}%"),
            )
        )
    q = q.order_by(Wallet.updated_at.desc())

    total = q.count()
    rows = q.offset((page - 1) * limit).limit(limit).all()
    items = []
    for wallet, user in rows:
        d = wallet.to_dict()
        d["user_email"] = user.email
        d["user_name"] = user.full_name
        items.append(d)

    return jsonify({"items": items, "total": total, "page": page, "limit": limit}), 200


# GET /api/v1/admin/wallets/<int:user_id>
@admin_wallets_bp.get("/<int:user_id>")
@role_required("admin")
def get_user_wallet(user_id):
    User.query.get_or_404(user_id)
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


# POST /api/v1/admin/wallets/<int:user_id>/adjust
@admin_wallets_bp.post("/<int:user_id>/adjust")
@role_required("admin")
def adjust_wallet(user_id):
    User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    try:
        amount = float(data.get("amount"))
    except (TypeError, ValueError):
        return jsonify({"error": "A valid amount is required."}), 400
    if amount == 0:
        return jsonify({"error": "Amount cannot be zero."}), 400

    note = (data.get("note") or "").strip() or "Manual admin adjustment"

    try:
        if amount > 0:
            wallet = credit_wallet(user_id, amount, type="admin_credit", reference=note)
        else:
            wallet = debit_wallet(user_id, abs(amount), type="admin_debit", reference=note)
        db.session.commit()
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

    return jsonify({"message": "Wallet adjusted.", "wallet": wallet.to_dict()}), 200
