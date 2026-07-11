import os
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, current_app
from flask_socketio import emit, join_room, leave_room
from werkzeug.utils import secure_filename
from extensions import db, socketio
from models.chat_session import ChatSession
from models.chat_message import ChatMessage
from models.user import User
from utils.decorators import role_required

chat_bp = Blueprint("chat", __name__, url_prefix="/api/v1/chat")

ALLOWED_IMAGE_EXTS = {"png", "jpg", "jpeg", "gif", "webp"}

def _allowed_image(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMAGE_EXTS


# ── REST: image upload ────────────────────────────────────────────────────────

@chat_bp.post("/upload-image")
def upload_chat_image():
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400
    file = request.files["file"]
    if not file.filename or not _allowed_image(file.filename):
        return jsonify({"error": "Only image files are allowed (png, jpg, gif, webp)."}), 400
    if file.content_length and file.content_length > 5 * 1024 * 1024:
        return jsonify({"error": "Image must be under 5 MB."}), 400

    chat_dir = os.path.join(current_app.root_path, "uploads", "chat")
    os.makedirs(chat_dir, exist_ok=True)

    ext = filename = secure_filename(file.filename).rsplit(".", 1)[-1].lower()
    unique_name = f"chat_{int(datetime.now(timezone.utc).timestamp() * 1000)}.{ext}"
    file.save(os.path.join(chat_dir, unique_name))

    url = f"/uploads/chat/{unique_name}"
    return jsonify({"url": url}), 201

# ── REST: admin session list ──────────────────────────────────────────────────

@chat_bp.get("/admin/sessions")
@role_required("admin")
def list_sessions():
    status = request.args.get("status", "open")
    q = ChatSession.query.order_by(ChatSession.updated_at.desc())
    if status != "all":
        q = q.filter_by(status=status)
    sessions = q.limit(100).all()
    return jsonify([s.to_dict() for s in sessions]), 200


@chat_bp.get("/admin/sessions/<int:session_id>")
@role_required("admin")
def get_session(session_id):
    session = ChatSession.query.get_or_404(session_id)
    return jsonify(session.to_dict(include_messages=True)), 200


# ── helpers ───────────────────────────────────────────────────────────────────

def _decode_token(token):
    if not token:
        return None
    try:
        from flask_jwt_extended import decode_token
        decoded = decode_token(token)
        return User.query.get(int(decoded["sub"]))
    except Exception:
        return None


def _session_summary(s):
    last = s.messages[-1] if s.messages else None
    return {
        "id": s.id,
        "display_name": s.display_name(),
        "status": s.status,
        "last_message": last.content[:80] if last else "",
        "last_sender": last.sender if last else None,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


# ── Socket.IO events ──────────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect(auth):
    pass  # auth happens per-event


@socketio.on("join_chat")
def on_join_chat(data):
    """User (guest or logged-in) starts or resumes a chat session."""
    token = (data or {}).get("token")
    guest_token = (data or {}).get("guest_token")
    guest_name = (data or {}).get("guest_name", "Guest")

    user = _decode_token(token)

    # Find existing open session
    session = None
    if user:
        session = (ChatSession.query
                   .filter_by(user_id=user.id, status="open")
                   .order_by(ChatSession.id.desc())
                   .first())
    elif guest_token:
        session = (ChatSession.query
                   .filter_by(guest_token=guest_token, status="open")
                   .order_by(ChatSession.id.desc())
                   .first())

    if not session:
        session = ChatSession(
            user_id=user.id if user else None,
            guest_token=guest_token if not user else None,
            guest_name=guest_name if not user else None,
        )
        db.session.add(session)
        db.session.commit()
        # Notify all connected admins of new session
        emit("new_session", _session_summary(session), room="admin_room")

    join_room(f"session_{session.id}")
    emit("chat_ready", {
        "session_id": session.id,
        "messages": [m.to_dict() for m in session.messages],
    })


@socketio.on("user_message")
def on_user_message(data):
    """User sends a message."""
    session_id = (data or {}).get("session_id")
    content = ((data or {}).get("content") or "").strip()
    if not session_id or not content:
        return

    session = ChatSession.query.get(session_id)
    if not session or session.status == "closed":
        emit("error", {"message": "Session is closed."})
        return

    msg = ChatMessage(session_id=session_id, sender="user", content=content)
    session.updated_at = datetime.now(timezone.utc)
    db.session.add(msg)
    db.session.commit()

    payload = msg.to_dict()
    emit("new_message", payload, room=f"session_{session_id}")
    # Push notification to admin room so admins see it even if not in the session room
    emit("session_notification", {**_session_summary(session), "message": payload},
         room="admin_room")


@socketio.on("join_admin")
def on_join_admin(data):
    """Admin joins the admin notification room and gets active sessions."""
    token = (data or {}).get("token")
    user = _decode_token(token)
    if not user or user.role != "admin":
        emit("error", {"message": "Unauthorized."})
        return

    join_room("admin_room")
    sessions = (ChatSession.query
                .filter_by(status="open")
                .order_by(ChatSession.updated_at.desc())
                .limit(50)
                .all())
    emit("active_sessions", [_session_summary(s) for s in sessions])


@socketio.on("admin_open_session")
def on_admin_open_session(data):
    """Admin opens a specific session to view history."""
    token = (data or {}).get("token")
    session_id = (data or {}).get("session_id")
    user = _decode_token(token)
    if not user or user.role != "admin":
        emit("error", {"message": "Unauthorized."})
        return

    session = ChatSession.query.get(session_id)
    if not session:
        emit("error", {"message": "Session not found."})
        return

    join_room(f"session_{session_id}")
    emit("chat_history", {
        "session_id": session_id,
        "display_name": session.display_name(),
        "messages": [m.to_dict() for m in session.messages],
    })


@socketio.on("admin_leave_session")
def on_admin_leave_session(data):
    session_id = (data or {}).get("session_id")
    if session_id:
        leave_room(f"session_{session_id}")


@socketio.on("admin_message")
def on_admin_message(data):
    """Admin replies in a session."""
    token = (data or {}).get("token")
    session_id = (data or {}).get("session_id")
    content = ((data or {}).get("content") or "").strip()
    user = _decode_token(token)
    if not user or user.role != "admin":
        emit("error", {"message": "Unauthorized."})
        return
    if not session_id or not content:
        return

    session = ChatSession.query.get(session_id)
    if not session or session.status == "closed":
        emit("error", {"message": "Session is closed."})
        return

    msg = ChatMessage(session_id=session_id, sender="admin", content=content)
    session.updated_at = datetime.now(timezone.utc)
    db.session.add(msg)
    db.session.commit()

    emit("new_message", msg.to_dict(), room=f"session_{session_id}")
    emit("session_notification", _session_summary(session), room="admin_room")


@socketio.on("close_session")
def on_close_session(data):
    """Admin or user closes a session."""
    token = (data or {}).get("token")
    session_id = (data or {}).get("session_id")
    user = _decode_token(token)
    if not session_id:
        return

    session = ChatSession.query.get(session_id)
    if not session:
        return

    # Only admin or the session owner can close
    is_owner = user and (user.role == "admin" or user.id == session.user_id)
    is_guest = not user and session.guest_token
    if not is_owner and not is_guest:
        return

    session.status = "closed"
    db.session.commit()

    emit("session_closed", {"session_id": session_id}, room=f"session_{session_id}")
    emit("session_notification", _session_summary(session), room="admin_room")
