from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class Cart(db.Model):
    __tablename__ = "carts"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = db.Column(db.Enum("active", "converted", "abandoned"), nullable=False, default="active")
    # Applied pre-checkout — re-validated server-side again at checkout, never trusted as-is.
    promo_code_id = db.Column(db.BigInteger, db.ForeignKey("promo_codes.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("carts", lazy="dynamic", cascade="all, delete-orphan"))
    items = db.relationship("CartItem", back_populates="cart", cascade="all, delete-orphan", lazy="selectin")
    promo_code = db.relationship("PromoCode")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "status": self.status,
            "promo_code": self.promo_code.summary_dict() if self.promo_code else None,
            "created_at": self.created_at.isoformat(),
            "items": [item.to_dict() for item in self.items]
        }
