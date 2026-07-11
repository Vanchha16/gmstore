from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class OrderItem(db.Model):
    __tablename__ = "order_items"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    order_id = db.Column(db.BigInteger, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = db.Column(db.BigInteger, db.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    title_snapshot = db.Column(db.String(200), nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    qty = db.Column(db.Integer, nullable=False, default=1)
    stock_item_id = db.Column(db.BigInteger, db.ForeignKey("stock_items.id", ondelete="SET NULL"), nullable=True)

    order = db.relationship("Order", back_populates="items")
    product = db.relationship("Product")
    stock_item = db.relationship("StockItem")

    def to_dict(self, reveal=False):
        data = {
            "id": self.id,
            "order_id": self.order_id,
            "product_id": self.product_id,
            "title_snapshot": self.title_snapshot,
            "unit_price": float(self.unit_price),
            "qty": self.qty,
            "stock_item_id": self.stock_item_id,
            "product": self.product.to_dict() if self.product else None
        }
        if reveal and self.stock_item:
            # We call to_dict(reveal=True) to decrypt the secret credential/key
            item_dict = self.stock_item.to_dict(reveal=True)
            data["secret_payload"] = item_dict.get("secret_payload")
        return data
