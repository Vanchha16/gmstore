from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class WalletTransaction(db.Model):
    __tablename__ = "wallet_transactions"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    wallet_id = db.Column(db.BigInteger, db.ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    type = db.Column(
        db.Enum("topup", "purchase", "refund", "admin_credit", "admin_debit"),
        nullable=False,
    )
    # Signed amount: positive = credit to wallet, negative = debit from wallet.
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    balance_after = db.Column(db.Numeric(10, 2), nullable=False)
    order_id = db.Column(db.BigInteger, db.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    reference = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    wallet = db.relationship("Wallet", back_populates="transactions")

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "amount": float(self.amount),
            "balance_after": float(self.balance_after),
            "order_id": self.order_id,
            "reference": self.reference,
            "created_at": self.created_at.isoformat(),
        }
