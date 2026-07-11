from datetime import datetime, timezone
from decimal import Decimal
from extensions import db
from models.wallet import Wallet
from models.wallet_transaction import WalletTransaction


def get_or_create_wallet(user_id: int) -> Wallet:
    wallet = Wallet.query.filter_by(user_id=user_id).with_for_update().first()
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, balance=0)
    db.session.add(wallet)
    db.session.flush()
    return wallet


def credit_wallet(user_id: int, amount, type: str, order_id: int = None, reference: str = None) -> Wallet:
    """Adds `amount` (must be positive) to the user's wallet. Caller must commit."""
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Credit amount must be positive.")

    wallet = get_or_create_wallet(user_id)
    wallet.balance = wallet.balance + amount
    wallet.updated_at = datetime.now(timezone.utc)

    db.session.add(WalletTransaction(
        wallet_id=wallet.id,
        type=type,
        amount=amount,
        balance_after=wallet.balance,
        order_id=order_id,
        reference=reference,
    ))
    return wallet


def debit_wallet(user_id: int, amount, type: str, order_id: int = None, reference: str = None) -> Wallet:
    """Removes `amount` (must be positive) from the user's wallet. Raises if insufficient. Caller must commit."""
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Debit amount must be positive.")

    wallet = get_or_create_wallet(user_id)
    if wallet.balance < amount:
        raise ValueError("Insufficient wallet balance.")

    wallet.balance = wallet.balance - amount
    wallet.updated_at = datetime.now(timezone.utc)

    db.session.add(WalletTransaction(
        wallet_id=wallet.id,
        type=type,
        amount=-amount,
        balance_after=wallet.balance,
        order_id=order_id,
        reference=reference,
    ))
    return wallet
