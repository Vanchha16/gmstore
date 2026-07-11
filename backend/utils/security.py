import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from flask import current_app

_dev_fernet: Fernet | None = None


def _fernet() -> Fernet:
    key = current_app.config.get("FERNET_KEY", "")
    if key:
        try:
            return Fernet(key.encode() if isinstance(key, str) else key)
        except (ValueError, Exception):
            pass  # fall through to dev key below

    # Dev fallback: derive a valid 32-byte Fernet key from SECRET_KEY
    global _dev_fernet
    if _dev_fernet is None:
        raw = hashlib.sha256(current_app.config["SECRET_KEY"].encode()).digest()
        derived = base64.urlsafe_b64encode(raw)
        _dev_fernet = Fernet(derived)
    return _dev_fernet


def encrypt_payload(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_payload(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        return "[decryption error]"
