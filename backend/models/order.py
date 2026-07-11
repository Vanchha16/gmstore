from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class Order(db.Model):
    __tablename__ = "orders"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    order_number = db.Column(db.String(30), unique=True, nullable=False)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = db.Column(
        db.Enum("pending_payment", "paid", "fulfilled", "cancelled", "refunded", "failed"),
        nullable=False,
        default="pending_payment"
    )
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    discount = db.Column(db.Numeric(10, 2), nullable=False, default=0.0)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="USD")
    is_preorder = db.Column(db.Boolean, nullable=False, default=False)
    # Amount of this order's total already debited from the buyer's wallet (0 if none).
    wallet_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    # The promo code applied at checkout, if any — `discount` above holds the resulting amount.
    promo_code_id = db.Column(db.BigInteger, db.ForeignKey("promo_codes.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    paid_at = db.Column(db.DateTime, nullable=True)
    fulfilled_at = db.Column(db.DateTime, nullable=True)
    delivery_confirmed = db.Column(db.Boolean, nullable=False, default=False)

    user = db.relationship("User", backref=db.backref("orders_list", lazy="dynamic", cascade="all, delete-orphan"))
    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin")
    payments = db.relationship("Payment", back_populates="order", cascade="all, delete-orphan", lazy="selectin")
    promo_code = db.relationship("PromoCode")

    def to_dict(self):
        return {
            "id": self.id,
            "order_number": self.order_number,
            "user_id": self.user_id,
            "status": self.status,
            "subtotal": float(self.subtotal),
            "discount": float(self.discount),
            "total": float(self.total),
            "currency": self.currency,
            "is_preorder": self.is_preorder,
            "wallet_amount": float(self.wallet_amount),
            "promo_code": self.promo_code.summary_dict() if self.promo_code else None,
            "delivery_confirmed": self.delivery_confirmed,
            "created_at": self.created_at.isoformat(),
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "fulfilled_at": self.fulfilled_at.isoformat() if self.fulfilled_at else None,
            "items": [item.to_dict(reveal=(self.status == "fulfilled")) for item in self.items],
            "payments": [p.to_dict() for p in self.payments]
        }
