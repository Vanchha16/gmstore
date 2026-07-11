from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class PromoCode(db.Model):
    __tablename__ = "promo_codes"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    code = db.Column(db.String(40), unique=True, nullable=False)
    discount_type = db.Column(db.Enum("percent", "fixed"), nullable=False)
    discount_value = db.Column(db.Numeric(10, 2), nullable=False)
    min_order_amount = db.Column(db.Numeric(10, 2), nullable=True)
    max_uses = db.Column(db.Integer, nullable=True)
    used_count = db.Column(db.Integer, nullable=False, default=0)
    max_uses_per_user = db.Column(db.Integer, nullable=True)
    starts_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    redemptions = db.relationship("PromoCodeRedemption", back_populates="promo_code", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "discount_type": self.discount_type,
            "discount_value": float(self.discount_value),
            "min_order_amount": float(self.min_order_amount) if self.min_order_amount is not None else None,
            "max_uses": self.max_uses,
            "used_count": self.used_count,
            "max_uses_per_user": self.max_uses_per_user,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }

    def summary_dict(self):
        """Small nested summary embedded on orders/carts — enough for buyer-facing UI."""
        return {
            "id": self.id,
            "code": self.code,
            "discount_type": self.discount_type,
            "discount_value": float(self.discount_value),
        }
