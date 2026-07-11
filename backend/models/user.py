from datetime import datetime, timezone
from extensions import db


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(30), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    role = db.Column(db.Enum("customer", "admin"), nullable=False, default="customer")
    is_verified = db.Column(db.Boolean, nullable=False, default=False)
    is_banned = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    otp_codes = db.relationship("OtpCode", back_populates="user", lazy="dynamic")
    favorites = db.relationship("Favorite", back_populates="user", cascade="all, delete-orphan", lazy="dynamic")
    reviews = db.relationship("Review", back_populates="user", cascade="all, delete-orphan", lazy="dynamic")
    preorders = db.relationship("Preorder", back_populates="user", cascade="all, delete-orphan", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "phone": self.phone,
            "avatar_url": self.avatar_url,
            "role": self.role,
            "is_verified": self.is_verified,
            "is_banned": self.is_banned,
            "created_at": self.created_at.isoformat(),
        }
