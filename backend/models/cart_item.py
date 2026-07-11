from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class CartItem(db.Model):
    __tablename__ = "cart_items"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    cart_id = db.Column(db.BigInteger, db.ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    product_id = db.Column(db.BigInteger, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    qty = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    cart = db.relationship("Cart", back_populates="items")
    product = db.relationship("Product")

    def to_dict(self):
        return {
            "id": self.id,
            "cart_id": self.cart_id,
            "product_id": self.product_id,
            "unit_price": float(self.unit_price),
            "qty": self.qty,
            "created_at": self.created_at.isoformat(),
            "product": self.product.to_dict(include_stock=True) if self.product else None
        }
