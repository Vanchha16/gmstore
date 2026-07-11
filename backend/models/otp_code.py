from datetime import datetime, timezone
from extensions import db


class OtpCode(db.Model):
    __tablename__ = "otp_codes"
    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id"), nullable=False)
    code_hash = db.Column(db.String(255), nullable=False)
    purpose = db.Column(db.Enum("register", "reset_password"), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    consumed_at = db.Column(db.DateTime, nullable=True)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", back_populates="otp_codes")

    @property
    def is_expired(self):
        return datetime.now(timezone.utc) > self.expires_at.replace(tzinfo=timezone.utc)

    @property
    def is_consumed(self):
        return self.consumed_at is not None
