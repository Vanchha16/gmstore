from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class Product(db.Model):
    __tablename__ = "products"
    __table_args__ = (
        db.Index("idx_product_slug_status", "slug", "status"),
        db.Index("idx_product_category", "category_id"),
        _TABLE_ARGS
    )

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(220), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    product_type = db.Column(db.Enum("account", "game_key"), nullable=False)
    category_id = db.Column(db.BigInteger, db.ForeignKey("categories.id"), nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    compare_at_price = db.Column(db.Numeric(10, 2), nullable=True)
    currency = db.Column(db.String(3), nullable=False, default="USD")
    status = db.Column(db.Enum("draft", "coming_soon", "active", "archived"), nullable=False, default="draft")
    # Manual admin toggle for the buyer-facing Available/Not Available badge — NOT derived
    # from stock_items. Admin may mark a product available before actually sourcing an
    # account/key; buyers can buy and pay without knowing real stock counts.
    is_available = db.Column(db.Boolean, nullable=False, default=True)
    release_date = db.Column(db.DateTime, nullable=True)
    is_featured = db.Column(db.Boolean, nullable=False, default=False)
    delivery_time = db.Column(db.String(100), nullable=True)
    rules = db.Column(db.Text, nullable=True)
    sold_count = db.Column(db.Integer, nullable=False, default=0)
    rating_avg = db.Column(db.Numeric(3, 2), nullable=False, default=0)
    rating_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    deleted_at = db.Column(db.DateTime, nullable=True)

    category = db.relationship("Category", back_populates="products")
    images = db.relationship("ProductImage", back_populates="product", order_by="ProductImage.sort_order", lazy="selectin")
    stock_items = db.relationship("StockItem", back_populates="product", lazy="dynamic")
    reviews = db.relationship("Review", back_populates="product", cascade="all, delete-orphan", order_by="Review.created_at.desc()", lazy="selectin")
    favorites = db.relationship("Favorite", back_populates="product", cascade="all, delete-orphan", lazy="dynamic")
    preorders = db.relationship("Preorder", back_populates="product", cascade="all, delete-orphan", lazy="dynamic")

    @property
    def available_stock(self):
        return self.stock_items.filter_by(status="available").count()

    def to_dict(self, include_stock=False):
        data = {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "description": self.description,
            "product_type": self.product_type,
            "category": self.category.to_dict() if self.category else None,
            "price": float(self.price),
            "compare_at_price": float(self.compare_at_price) if self.compare_at_price else None,
            "currency": self.currency,
            "status": self.status,
            "is_available": self.is_available,
            "release_date": self.release_date.isoformat() if self.release_date else None,
            "is_featured": self.is_featured,
            "delivery_time": self.delivery_time,
            "rules": self.rules,
            "sold_count": self.sold_count,
            "rating_avg": float(self.rating_avg),
            "rating_count": self.rating_count,
            "images": [img.to_dict() for img in self.images],
            "created_at": self.created_at.isoformat(),
        }
        if include_stock:
            data["available_stock"] = self.available_stock
        return data


class ProductImage(db.Model):
    __tablename__ = "product_images"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    product_id = db.Column(db.BigInteger, db.ForeignKey("products.id"), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_primary = db.Column(db.Boolean, nullable=False, default=False)

    product = db.relationship("Product", back_populates="images")

    def to_dict(self):
        return {"id": self.id, "url": self.url, "sort_order": self.sort_order, "is_primary": self.is_primary}
