from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class Wallet(db.Model):
    __tablename__ = "wallets"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    balance = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    currency = db.Column(db.String(3), nullable=False, default="USD")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = db.relationship("User", backref=db.backref("wallet", uselist=False, cascade="all, delete-orphan"))
    transactions = db.relationship(
        "WalletTransaction", back_populates="wallet",
        cascade="all, delete-orphan", lazy="dynamic",
        order_by="WalletTransaction.created_at.desc()",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "balance": float(self.balance),
            "currency": self.currency,
            "updated_at": self.updated_at.isoformat(),
        }
