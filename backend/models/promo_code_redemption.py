from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class PromoCodeRedemption(db.Model):
    __tablename__ = "promo_code_redemptions"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    promo_code_id = db.Column(db.BigInteger, db.ForeignKey("promo_codes.id"), nullable=False)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    order_id = db.Column(db.BigInteger, db.ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False)
    discount_amount = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    promo_code = db.relationship("PromoCode", back_populates="redemptions")
    user = db.relationship("User")
    order = db.relationship("Order")

    def to_dict(self):
        return {
            "id": self.id,
            "promo_code_id": self.promo_code_id,
            "user_id": self.user_id,
            "order_id": self.order_id,
            "discount_amount": float(self.discount_amount),
            "created_at": self.created_at.isoformat(),
        }
