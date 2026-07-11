from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, make_response, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity,
)
from passlib.hash import bcrypt
from extensions import db
from models.user import User
from services import otp_service, mail_service

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


def _token_response(user: User):
    access = create_access_token(identity=str(user.id))
    refresh = create_refresh_token(identity=str(user.id))
    resp = make_response(jsonify({"access_token": access, "user": user.to_dict()}), 200)
    resp.set_cookie(
        "refresh_token", refresh,
        httponly=True, samesite="Lax",
        secure=current_app.config.get("JWT_COOKIE_SECURE", False),
        max_age=30 * 24 * 3600,
    )
    return resp


# POST /api/v1/auth/register
@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")
    full_name = (data.get("full_name") or "").strip()

    if not email or not password or not full_name:
        return jsonify({"error": "email, password, and full_name are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered."}), 409

    user = User(
        email=email,
        password_hash=bcrypt.hash(password),
        full_name=full_name,
    )
    db.session.add(user)
    db.session.flush()

    code = otp_service.create_otp(user.id, "register")
    db.session.commit()

    mail_service.send_otp_email(email, full_name, code, "register")
    
    resp_data = {"message": "Account created. Check your email for the verification code."}
    from flask import current_app
    if current_app.config.get("ENV") == "development" or current_app.config.get("DEBUG"):
        resp_data["debug_otp"] = code
    return jsonify(resp_data), 201


# POST /api/v1/auth/verify-otp
@auth_bp.post("/verify-otp")
def verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found."}), 404

    ok, msg = otp_service.verify_otp(user.id, code, "register")
    if not ok:
        db.session.commit()
        return jsonify({"error": msg}), 400

    user.is_verified = True
    db.session.commit()
    return _token_response(user)


# POST /api/v1/auth/resend-otp
@auth_bp.post("/resend-otp")
def resend_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found."}), 404
    if user.is_verified:
        return jsonify({"error": "Account already verified."}), 400

    ok, msg = otp_service.can_resend(user.id, "register")
    if not ok:
        return jsonify({"error": msg}), 429

    code = otp_service.create_otp(user.id, "register")
    db.session.commit()

    mail_service.send_otp_email(email, user.full_name, code, "register")
    
    resp_data = {"message": "Verification code resent."}
    from flask import current_app
    if current_app.config.get("ENV") == "development" or current_app.config.get("DEBUG"):
        resp_data["debug_otp"] = code
    return jsonify(resp_data), 200


# POST /api/v1/auth/login
@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.verify(password, user.password_hash):
        return jsonify({"error": "Invalid email or password."}), 401
    if not user.is_verified:
        return jsonify({"error": "Please verify your email before logging in."}), 403
    if user.is_banned:
        return jsonify({"error": "This account has been suspended."}), 403

    return _token_response(user)


# POST /api/v1/auth/google
@auth_bp.post("/google")
def google_auth():
    import string
    import random
    import requests
    from flask import current_app
    
    data = request.get_json(silent=True) or {}
    token = data.get("token", "")
    
    if not token:
        return jsonify({"error": "Google ID token is required."}), 400

    # Hybrid Sandbox Bypass for Local Developer Testing
    if token.startswith("sandbox:") and current_app.config.get("ENV") != "production":
        parts = token.split(":")
        email = parts[1].strip().lower()
        full_name = parts[2].strip() if len(parts) > 2 else email.split("@")[0]
        if not email or "@" not in email:
            return jsonify({"error": "Invalid sandbox email."}), 400
    else:
        try:
            # Request verification from Google Token Info API
            resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}", timeout=8)
            if resp.status_code != 200:
                return jsonify({"error": "Invalid Google token signature. Make sure your client ID is valid."}), 401
                
            id_info = resp.json()
            
            # Verify issuer
            if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
                return jsonify({"error": "Invalid token issuer."}), 401
                
            # Verify client ID audience if configured in env
            client_id = current_app.config.get("GOOGLE_CLIENT_ID")
            if client_id and client_id != "your-google-client-id.apps.googleusercontent.com":
                if id_info.get("aud") != client_id:
                    return jsonify({"error": "Invalid token audience."}), 401

            email = id_info.get("email", "").strip().lower()
            full_name = id_info.get("name", "").strip()
            
            if not email or "@" not in email:
                return jsonify({"error": "Verified email is missing from Google token."}), 400
                
            if not full_name:
                full_name = email.split("@")[0]

        except Exception as e:
            current_app.logger.error("Google authentication failed: %s", str(e))
            return jsonify({"error": "Google verification connection timed out."}), 500

    user = User.query.filter_by(email=email).first()
    if not user:
        # Create a new pre-verified user
        chars = string.ascii_letters + string.digits
        random_pass = "".join(random.choice(chars) for _ in range(16))
        user = User(
            email=email,
            password_hash=bcrypt.hash(random_pass),
            full_name=full_name,
            is_verified=True
        )
        db.session.add(user)
        db.session.commit()
    else:
        if user.is_banned:
            return jsonify({"error": "This account has been suspended."}), 403
        if not user.is_verified:
            user.is_verified = True
            db.session.commit()

    return _token_response(user)


# POST /api/v1/auth/refresh
@auth_bp.post("/refresh")
def refresh():
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        return jsonify({"error": "No refresh token."}), 401

    from flask_jwt_extended import decode_token
    from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
    try:
        decoded = decode_token(refresh_token)
        user_id = decoded["sub"]
    except Exception:
        return jsonify({"error": "Invalid or expired refresh token."}), 401

    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found."}), 404

    access = create_access_token(identity=str(user.id))
    return jsonify({"access_token": access}), 200


# POST /api/v1/auth/logout
@auth_bp.post("/logout")
def logout():
    resp = make_response(jsonify({"message": "Logged out."}), 200)
    resp.delete_cookie("refresh_token")
    return resp


# POST /api/v1/auth/forgot-password
@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    user = User.query.filter_by(email=email).first()
    # Always 200 to avoid user enumeration. Note: intentionally NOT gated on
    # is_verified — an account that registered but never finished OTP verify
    # (expired code, closed tab, etc.) would otherwise be a dead end, since
    # register() also blocks re-signup for any existing email. Proving
    # ownership of the inbox via this code is verification enough on its own.
    if user:
        ok, _ = otp_service.can_resend(user.id, "reset_password")
        if ok:
            code = otp_service.create_otp(user.id, "reset_password")
            db.session.commit()
            mail_service.send_otp_email(email, user.full_name, code, "reset_password")
            
            from flask import current_app
            if current_app.config.get("ENV") == "development" or current_app.config.get("DEBUG"):
                return jsonify({
                    "message": "If that email is registered you will receive a reset code.",
                    "debug_otp": code
                }), 200

    return jsonify({"message": "If that email is registered you will receive a reset code."}), 200


# POST /api/v1/auth/reset-password
@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    new_password = data.get("new_password", "")

    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found."}), 404

    ok, msg = otp_service.verify_otp(user.id, code, "reset_password")
    if not ok:
        db.session.commit()
        return jsonify({"error": msg}), 400

    user.password_hash = bcrypt.hash(new_password)
    user.is_verified = True  # proving the emailed code = proving inbox ownership
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"message": "Password reset successfully."}), 200
