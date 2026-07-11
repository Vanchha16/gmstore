from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class Preorder(db.Model):
    __tablename__ = "preorders"
    __table_args__ = (
        db.UniqueConstraint("user_id", "product_id", name="uq_user_product_preorder"),
        _TABLE_ARGS
    )

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id = db.Column(db.BigInteger, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    status = db.Column(db.Enum("waiting", "notified", "converted", "cancelled"), nullable=False, default="waiting")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    product = db.relationship("Product", back_populates="preorders")
    user = db.relationship("User", back_populates="preorders")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "product_id": self.product_id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "product": self.product.to_dict() if self.product else None
        }
