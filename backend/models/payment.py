from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class Payment(db.Model):
    __tablename__ = "payments"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    order_id = db.Column(db.BigInteger, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    provider = db.Column(db.Enum("payway", "bakong", "mock", "wallet"), nullable=False, default="mock")
    method = db.Column(db.Enum("khqr", "card", "abapay", "wallet"), nullable=False, default="khqr")
    provider_txn_id = db.Column(db.String(100), nullable=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(
        db.Enum("created", "pending", "success", "failed", "refunded"),
        nullable=False,
        default="created"
    )
    raw_response = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    order = db.relationship("Order", back_populates="payments")

    def to_dict(self):
        return {
            "id": self.id,
            "order_id": self.order_id,
            "provider": self.provider,
            "method": self.method,
            "provider_txn_id": self.provider_txn_id,
            "amount": float(self.amount),
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
