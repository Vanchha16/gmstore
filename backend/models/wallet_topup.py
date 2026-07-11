from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class WalletTopup(db.Model):
    __tablename__ = "wallet_topups"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    wallet_id = db.Column(db.BigInteger, db.ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="USD")
    provider = db.Column(db.Enum("bakong", "mock"), nullable=False, default="bakong")
    qr_md5 = db.Column(db.String(64), nullable=True)
    status = db.Column(
        db.Enum("pending", "success", "cancelled", "expired"),
        nullable=False,
        default="pending",
    )
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime, nullable=True)

    wallet = db.relationship("Wallet")

    def to_dict(self):
        return {
            "id": self.id,
            "amount": float(self.amount),
            "currency": self.currency,
            "provider": self.provider,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
