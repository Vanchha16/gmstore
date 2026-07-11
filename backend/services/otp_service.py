import random
import string
from datetime import datetime, timedelta, timezone
from passlib.hash import bcrypt
from extensions import db
from models.otp_code import OtpCode

OTP_TTL_MINUTES = 10
MAX_ATTEMPTS = 5


def _generate_code():
    return "".join(random.choices(string.digits, k=6))


def create_otp(user_id: int, purpose: str) -> str:
    code = _generate_code()
    code_hash = bcrypt.hash(code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)

    otp = OtpCode(
        user_id=user_id,
        code_hash=code_hash,
        purpose=purpose,
        expires_at=expires_at,
    )
    db.session.add(otp)
    db.session.flush()
    return code


def verify_otp(user_id: int, code: str, purpose: str) -> tuple[bool, str]:
    otp = (
        OtpCode.query
        .filter_by(user_id=user_id, purpose=purpose, consumed_at=None)
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if otp is None:
        return False, "No active OTP found."
    if otp.is_expired:
        return False, "OTP has expired."
    if otp.attempts >= MAX_ATTEMPTS:
        return False, "Too many attempts. Request a new OTP."

    if not bcrypt.verify(code, otp.code_hash):
        otp.attempts += 1
        db.session.flush()
        remaining = MAX_ATTEMPTS - otp.attempts
        return False, f"Invalid code. {remaining} attempt(s) left."

    otp.consumed_at = datetime.now(timezone.utc)
    db.session.flush()
    return True, "ok"


def can_resend(user_id: int, purpose: str) -> tuple[bool, str]:
    """Allow resend only if no OTP was created in the last 60 seconds."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
    recent = (
        OtpCode.query
        .filter(
            OtpCode.user_id == user_id,
            OtpCode.purpose == purpose,
            OtpCode.created_at > cutoff,
        )
        .first()
    )
    if recent:
        return False, "Please wait 60 seconds before requesting a new OTP."
    return True, "ok"
