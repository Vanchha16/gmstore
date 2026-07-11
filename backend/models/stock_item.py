from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class StockItem(db.Model):
    __tablename__ = "stock_items"
    __table_args__ = (
        db.Index("idx_stock_product_status", "product_id", "status"),
        _TABLE_ARGS
    )

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    product_id = db.Column(db.BigInteger, db.ForeignKey("products.id"), nullable=False)
    secret_payload = db.Column(db.Text, nullable=False)  # Fernet-encrypted at rest
    status = db.Column(db.Enum("available", "reserved", "sold"), nullable=False, default="available")
    order_id = db.Column(db.BigInteger, db.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    reserved_until = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    product = db.relationship("Product", back_populates="stock_items")

    def to_dict(self, reveal=False):
        data = {
            "id": self.id,
            "product_id": self.product_id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }
        if reveal:
            from utils.security import decrypt_payload
            data["secret_payload"] = decrypt_payload(self.secret_payload)
        return data
