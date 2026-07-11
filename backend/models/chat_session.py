from datetime import datetime, timezone
from extensions import db

_TABLE_ARGS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_row_format": "DYNAMIC"}


class ChatSession(db.Model):
    __tablename__ = "chat_sessions"
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    guest_token = db.Column(db.String(64), nullable=True, index=True)
    guest_name = db.Column(db.String(100), nullable=True)
    status = db.Column(db.Enum("open", "closed"), nullable=False, default="open")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", backref=db.backref("chat_sessions", lazy="dynamic"))
    messages = db.relationship("ChatMessage", back_populates="session",
                               order_by="ChatMessage.created_at", cascade="all, delete-orphan")

    def display_name(self):
        if self.user:
            return self.user.full_name
        return self.guest_name or "Guest"

    def last_message(self):
        if self.messages:
            return self.messages[-1].content[:80]
        return ""

    def to_dict(self, include_messages=False):
        d = {
            "id": self.id,
            "user_id": self.user_id,
            "display_name": self.display_name(),
            "status": self.status,
            "last_message": self.last_message(),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_messages:
            d["messages"] = [m.to_dict() for m in self.messages]
        return d
