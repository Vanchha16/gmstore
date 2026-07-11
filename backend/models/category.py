from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class Category(db.Model):
    __tablename__ = "categories"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False)
    icon_url = db.Column(db.String(500), nullable=True)

    products = db.relationship("Product", back_populates="category", lazy="dynamic")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "slug": self.slug, "icon_url": self.icon_url}
