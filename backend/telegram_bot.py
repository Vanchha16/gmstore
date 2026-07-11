#!/usr/bin/env python3
"""
GM Store Telegram Storefront Bot  (@autosale16_bot)
Run alongside Flask:  python telegram_bot.py

Payment flow:
  mock mode  → instant confirmation (for dev/testing)
  bakong mode → KHQR QR image sent to user; background thread polls until paid
"""
import io
import sys
import time
import random
import secrets
import threading
import requests

from app import create_app

app = create_app()

with app.app_context():
    BOT_TOKEN           = app.config.get("TELEGRAM_STORE_BOT_TOKEN", "")
    PAYMENT_MODE        = app.config.get("PAYMENT_PROVIDER", "mock")  # "mock" or "bakong"
    ADMIN_NOTIFY_TOKEN  = app.config.get("TELEGRAM_BOT_TOKEN", "")
    ADMIN_NOTIFY_CHAT_ID = app.config.get("TELEGRAM_CHAT_ID", "")

if not BOT_TOKEN:
    print("[BOT] TELEGRAM_STORE_BOT_TOKEN not set in .env — exiting.")
    sys.exit(1)

API              = f"https://api.telegram.org/bot{BOT_TOKEN}"
PRODUCTS_PER_PAGE = 5
PAYMENT_TIMEOUT   = 600   # 10 minutes to complete payment
POLL_INTERVAL     = 5     # seconds between Bakong status checks
MAX_ON_DEMAND_QTY = 10    # same per-line cap as the website cart (blueprints/cart.py)

# In-memory carts:  { chat_id: [{"product_id", "title", "price", "qty"}] }
carts: dict = {}

# Pending payments: { order_id: {"chat_id", "msg_id", "qr_md5"} }
pending_payments: dict = {}

# chat_ids currently expected to send a free-text message for Contact Admin
awaiting_contact: set = set()

# Maps admin-bot message_id -> {"chat_id", "name"} so admin replies can be relayed back
contact_relay: dict = {}


# ─────────────────────── Telegram API helpers ─────────────────────────────────

def _post(method: str, **data):
    try:
        r = requests.post(f"{API}/{method}", json=data, timeout=10)
        return r.json()
    except Exception as exc:
        print(f"[BOT] API error ({method}): {exc}", flush=True)
        return {}


def _post_file(method: str, files: dict, data: dict):
    try:
        r = requests.post(f"{API}/{method}", files=files, data=data, timeout=15)
        return r.json()
    except Exception as exc:
        print(f"[BOT] API file error ({method}): {exc}", flush=True)
        return {}


def download_telegram_file(file_id: str, token: str) -> bytes:
    """Fetch a file's raw bytes from Telegram given a file_id and the bot token that received it."""
    r = requests.get(f"https://api.telegram.org/bot{token}/getFile", params={"file_id": file_id}, timeout=10)
    file_path = r.json()["result"]["file_path"]
    r2 = requests.get(f"https://api.telegram.org/file/bot{token}/{file_path}", timeout=15)
    return r2.content


def send(chat_id, text: str, kb=None, parse_mode="Markdown") -> dict:
    params = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    if kb:
        params["reply_markup"] = kb
    return _post("sendMessage", **params)


def edit(chat_id, msg_id: int, text: str, kb=None, parse_mode="Markdown"):
    params = {
        "chat_id": chat_id,
        "message_id": msg_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    if kb:
        params["reply_markup"] = kb
    return _post("editMessageText", **params)


def send_photo(chat_id, image_bytes: bytes, caption: str, kb=None) -> dict:
    data = {"chat_id": chat_id, "caption": caption, "parse_mode": "Markdown"}
    if kb:
        import json
        data["reply_markup"] = json.dumps(kb)
    files = {"photo": ("qr.png", image_bytes, "image/png")}
    return _post_file("sendPhoto", files=files, data=data)


def delete_msg(chat_id, msg_id: int):
    _post("deleteMessage", chat_id=chat_id, message_id=msg_id)


def answer_cb(cb_id, text="", alert=False):
    _post("answerCallbackQuery", callback_query_id=cb_id, text=text, show_alert=alert)


def notify_admin_of_contact(chat_id: int, name: str, username: str, message_text: str):
    """
    Forward a Telegram contact message to the admin via the admin notification bot.
    Remembers the notification's message_id -> (user chat_id, name) so that if the
    admin replies to this exact message in Telegram, admin_bot_poll_loop() can
    relay that reply back to the user via the store bot.
    """
    if not ADMIN_NOTIFY_TOKEN or not ADMIN_NOTIFY_CHAT_ID:
        return
    import html
    handle_line = f"🔗 Telegram: @{html.escape(username)}" if username else "🔗 Telegram: <i>no username set</i>"
    text = (
        f"📩 <b>New Telegram contact message</b>\n\n"
        f"👤 From: {html.escape(name)}\n"
        f"{handle_line}\n"
        f"🆔 chat_id: <code>{chat_id}</code>\n\n"
        f"{html.escape(message_text)}\n\n"
        f"<i>Reply directly to this message to answer the user.</i>"
    )
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{ADMIN_NOTIFY_TOKEN}/sendMessage",
            json={"chat_id": ADMIN_NOTIFY_CHAT_ID, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        sent_msg_id = r.json().get("result", {}).get("message_id")
        if sent_msg_id:
            contact_relay[sent_msg_id] = {"chat_id": chat_id, "name": name}
    except Exception as exc:
        print(f"[BOT] Admin contact notify failed: {exc}", flush=True)


def notify_admin_of_contact_photo(chat_id: int, name: str, username: str, image_bytes: bytes, caption: str):
    """Forward a user's photo (from Contact Admin) to the admin via sendPhoto, with the same reply-relay tracking."""
    if not ADMIN_NOTIFY_TOKEN or not ADMIN_NOTIFY_CHAT_ID:
        return
    import html
    handle_line = f"@{username}" if username else "no username set"
    cap = (
        f"📩 New Telegram contact message (photo)\n"
        f"From: {name} ({handle_line})\n"
        f"chat_id: {chat_id}\n\n"
        f"{caption}\n\n"
        f"Reply to this message to answer the user."
    )
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{ADMIN_NOTIFY_TOKEN}/sendPhoto",
            files={"photo": ("photo.jpg", image_bytes, "image/jpeg")},
            data={"chat_id": ADMIN_NOTIFY_CHAT_ID, "caption": cap},
            timeout=15,
        )
        sent_msg_id = r.json().get("result", {}).get("message_id")
        if sent_msg_id:
            contact_relay[sent_msg_id] = {"chat_id": chat_id, "name": name}
    except Exception as exc:
        print(f"[BOT] Admin contact photo notify failed: {exc}", flush=True)


def admin_bot_poll_loop():
    """
    Background thread: polls the admin notification bot (@gmst0re_bot) for the
    admin's replies. When the admin replies to a forwarded contact-message
    notification, relay that reply text to the original user via the store bot.
    """
    if not ADMIN_NOTIFY_TOKEN:
        return
    admin_api = f"https://api.telegram.org/bot{ADMIN_NOTIFY_TOKEN}"
    requests.post(f"{admin_api}/deleteWebhook", json={"drop_pending_updates": True}, timeout=10)
    offset = 0
    print("[BOT] Admin reply relay listening on gmst0re_bot...", flush=True)
    while True:
        try:
            r = requests.get(
                f"{admin_api}/getUpdates",
                params={"offset": offset, "timeout": 30, "allowed_updates": ["message"]},
                timeout=35,
            )
            for update in r.json().get("result", []):
                offset = update["update_id"] + 1
                msg = update.get("message", {})
                reply_to = msg.get("reply_to_message")
                text = msg.get("text", "").strip()
                if not reply_to or not text:
                    continue
                target = contact_relay.get(reply_to.get("message_id"))
                if not target:
                    continue
                send(target["chat_id"], f"💬 *Admin reply:*\n\n{text}")
                requests.post(
                    f"{admin_api}/sendMessage",
                    json={"chat_id": msg["chat"]["id"], "text": f"✅ Sent to {target['name']}.",
                          "reply_to_message_id": msg["message_id"]},
                    timeout=10,
                )
        except Exception as exc:
            print(f"[BOT] Admin reply poll error: {exc} — retrying in 5s", flush=True)
            time.sleep(5)


def inline(rows: list) -> dict:
    return {
        "inline_keyboard": [
            [{"text": t, "callback_data": d} for t, d in row]
            for row in rows
        ]
    }


# ─────────────────────── QR code image helper ─────────────────────────────────

def make_qr_image(qr_string: str) -> bytes:
    """Render a KHQR string as a PNG image and return raw bytes."""
    import qrcode
    qr = qrcode.QRCode(box_size=8, border=3,
                        error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(qr_string)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ──────────────────────── User management ────────────────────────────────────

def get_or_create_tg_user(chat_id: int, first_name: str, last_name: str = ""):
    from models.user import User
    from extensions import db
    email = f"tg_{chat_id}@gmstore.local"
    user = User.query.filter_by(email=email).first()
    if not user:
        full_name = f"{first_name} {last_name}".strip() or f"TG {chat_id}"
        user = User(
            email=email,
            password_hash=secrets.token_hex(32),
            full_name=full_name,
            role="customer",
            is_verified=True,
        )
        db.session.add(user)
        db.session.commit()
    return user


# ──────────────────────────── Cart helpers ─────────────────────────────────────

def cart_add(chat_id: int, product_id: int, title: str, price: float):
    cart = carts.setdefault(chat_id, [])
    for item in cart:
        if item["product_id"] == product_id:
            item["qty"] += 1
            return
    cart.append({"product_id": product_id, "title": title, "price": price, "qty": 1})


def cart_total(chat_id: int) -> float:
    return sum(i["price"] * i["qty"] for i in carts.get(chat_id, []))


def cart_summary(chat_id: int) -> str:
    cart = carts.get(chat_id, [])
    if not cart:
        return "_Your cart is empty._"
    lines = [f"• *{i['title']}* x{i['qty']} — ${i['price'] * i['qty']:.2f}" for i in cart]
    lines.append(f"\n💰 *Total: ${cart_total(chat_id):.2f}*")
    return "\n".join(lines)


# ────────────────── Order creation (before payment) ──────────────────────────

def create_pending_order(chat_id: int, user):
    """Create order + payment record and return (order, qr_data)."""
    from extensions import db
    from models.cart import Cart
    from models.cart_item import CartItem
    from models.product import Product
    from services.order_service import create_order_from_cart
    from services.payway_service import get_payment_details

    tg_cart = carts.get(chat_id, [])
    if not tg_cart:
        raise ValueError("Cart is empty.")

    prev = Cart.query.filter_by(user_id=user.id, status="active").first()
    if prev:
        prev.status = "abandoned"

    db_cart = Cart(user_id=user.id, status="active")
    db.session.add(db_cart)
    db.session.flush()

    for item in tg_cart:
        product = Product.query.get(item["product_id"])
        if not product:
            continue
        db.session.add(CartItem(
            cart_id=db_cart.id,
            product_id=item["product_id"],
            qty=item["qty"],
            unit_price=item["price"],
        ))
    db.session.commit()

    order = create_order_from_cart(
        user.id, db_cart.id,
        payment_provider="bakong",
        payment_method="khqr",
    )

    if PAYMENT_MODE == "mock":
        qr_data = {"qr_string": "MOCK", "qr_md5": f"mock_{order.id}"}
    else:
        qr_data = get_payment_details(order)

    return order, qr_data


# ─────────────── Background payment poller (Bakong) ──────────────────────────

def _poll_payment(order_id: int, chat_id: int, status_msg_id: int, qr_md5: str):
    """
    Runs in a daemon thread. Polls Bakong every POLL_INTERVAL seconds.
    On success → marks the order paid and notifies the user; credentials are
    NOT auto-delivered here — admin must confirm delivery in the admin panel,
    same as every other payment path.
    On timeout → cancels order and notifies user.
    """
    deadline = time.time() + PAYMENT_TIMEOUT
    print(f"[BOT] Polling payment for order {order_id} (chat {chat_id})", flush=True)

    while time.time() < deadline:
        time.sleep(POLL_INTERVAL)

        with app.app_context():
            from services.payway_service import check_bakong_payment
            paid = check_bakong_payment(qr_md5)

        if paid:
            try:
                with app.app_context():
                    from services.order_service import mark_order_paid
                    order = mark_order_paid(
                        order_id,
                        provider_txn_id=qr_md5 if PAYMENT_MODE != "mock" else f"TG-MOCK-{random.randint(10000000,99999999)}",
                        raw_response={"source": "telegram", "qr_md5": qr_md5},
                    )
                    order_number = order.order_number

                delete_msg(chat_id, status_msg_id)
                pending_payments.pop(order_id, None)
                carts.pop(chat_id, None)
                send(chat_id,
                     f"✅ *Payment received for order `{order_number}`!*\n\n"
                     "Your order is now pending admin approval.\n"
                     "You will receive your account credentials here once the admin confirms.\n\n"
                     "⏳ _Usually within a few minutes._",
                     inline([[("📦 My Orders", "orders"), ("🛍 Shop More", "products_0")]]))
                print(f"[BOT] Order {order_id} marked paid, awaiting admin delivery (chat {chat_id})", flush=True)
            except Exception as exc:
                import traceback
                print(f"[BOT] Mark-paid error for order {order_id}: {exc}", flush=True)
                traceback.print_exc()
                send(chat_id, f"❌ Error recording payment. Contact support with order ID: `{order_id}`")
            return

    # Timeout — cancel order
    print(f"[BOT] Payment timeout for order {order_id}", flush=True)
    try:
        with app.app_context():
            from services.inventory_service import cancel_order
            cancel_order(order_id)
    except Exception:
        pass
    pending_payments.pop(order_id, None)
    delete_msg(chat_id, status_msg_id)
    send(chat_id,
         "⏰ *Payment timed out.*\n\nYour order was cancelled. Start a new order whenever you're ready.",
         inline([[("🛍 Browse Products", "products_0"), ("🏠 Menu", "menu")]]))


def start_payment_poller(order_id: int, chat_id: int, status_msg_id: int, qr_md5: str):
    t = threading.Thread(
        target=_poll_payment,
        args=(order_id, chat_id, status_msg_id, qr_md5),
        daemon=True,
    )
    t.start()


# ──────────────────────────── Screens ────────────────────────────────────────

def show_menu(chat_id: int, name: str, msg_id=None):
    text = (
        f"👋 Welcome to *GM Store*, {name}!\n\n"
        "Buy game accounts instantly — right here in Telegram.\n\n"
        "Choose an option:"
    )
    kb = inline([
        [("🛍 Browse Products", "products_0")],
        [("🛒 My Cart", "cart"), ("📦 My Orders", "orders")],
        [("📩 Contact Admin", "contact_admin"), ("❓ Help", "help")],
    ])
    if msg_id:
        edit(chat_id, msg_id, text, kb)
    else:
        send(chat_id, text, kb)


def show_products(chat_id: int, msg_id=None, page: int = 0):
    with app.app_context():
        from models.product import Product

        all_p = (Product.query.filter_by(status="active")
                 .offset(page * PRODUCTS_PER_PAGE)
                 .limit(PRODUCTS_PER_PAGE + 1)
                 .all())
        has_more = len(all_p) > PRODUCTS_PER_PAGE
        products = all_p[:PRODUCTS_PER_PAGE]
        # Same rule as the website: availability is the admin's manual is_available
        # toggle, never a live stock count — buyers can order on-demand at 0 stock.
        avail_map = {p.id: p.is_available for p in products}

    if not products:
        text = "😔 No products available right now."
        kb = inline([[("🏠 Menu", "menu")]])
        if msg_id:
            edit(chat_id, msg_id, text, kb)
        else:
            send(chat_id, text, kb)
        return

    lines = ["🛍 *Available Products* — tap one to view details:\n"]
    for p in products:
        icon = "✅" if avail_map[p.id] else "❌"
        lines.append(f"{icon} *{p.title}* — ${float(p.price):.2f}")

    rows = [[( f"🎮 {p.title[:28]}", f"view_{p.id}")] for p in products]
    nav = []
    if page > 0:
        nav.append(("⬅️ Prev", f"products_{page - 1}"))
    if has_more:
        nav.append(("Next ➡️", f"products_{page + 1}"))
    if nav:
        rows.append(nav)
    rows.append([("🛒 My Cart", "cart"), ("🏠 Menu", "menu")])

    text = "\n".join(lines)
    kb = inline(rows)
    if msg_id:
        edit(chat_id, msg_id, text, kb)
    else:
        send(chat_id, text, kb)


def show_product_detail(chat_id: int, msg_id: int, product_id: int):
    with app.app_context():
        from models.product import Product
        p = Product.query.get(product_id)
        if not p:
            edit(chat_id, msg_id, "❌ Product not found.",
                 inline([[("⬅️ Back", "products_0")]]))
            return
        is_available = p.is_available

    icon = "✅ Available" if is_available else "❌ Not Available"
    text = (
        f"🎮 *{p.title}*\n\n"
        f"{(p.description or '').strip()}\n\n"
        f"💰 Price: *${float(p.price):.2f}*\n"
        f"📦 Status: {icon}"
    )
    if is_available:
        kb = inline([
            [("🛒 Add to Cart", f"add_{product_id}")],
            [("⬅️ Back", "products_0"), ("🏠 Menu", "menu")],
        ])
    else:
        kb = inline([[("⬅️ Back", "products_0"), ("🏠 Menu", "menu")]])
    edit(chat_id, msg_id, text, kb)


def show_cart(chat_id: int, msg_id=None):
    cart = carts.get(chat_id, [])
    text = f"🛒 *Your Cart*\n\n{cart_summary(chat_id)}"
    if cart:
        kb = inline([
            [("✅ Checkout", "checkout")],
            [("🗑 Clear Cart", "clear_cart"), ("🛍 Keep Shopping", "products_0")],
            [("🏠 Menu", "menu")],
        ])
    else:
        kb = inline([[("🛍 Browse Products", "products_0"), ("🏠 Menu", "menu")]])
    if msg_id:
        edit(chat_id, msg_id, text, kb)
    else:
        send(chat_id, text, kb)


def show_orders(chat_id: int, user_id: int, msg_id=None):
    with app.app_context():
        from models.order import Order
        orders = (Order.query.filter_by(user_id=user_id)
                  .order_by(Order.id.desc()).limit(5).all())

    icons = {"pending_payment": "⏳", "paid": "💳", "fulfilled": "✅",
             "cancelled": "❌", "refunded": "💸", "failed": "⚠️"}
    if not orders:
        text = "📦 You have no orders yet.\n\nStart shopping below!"
    else:
        lines = ["📦 *Your Recent Orders:*\n"]
        for o in orders:
            lines.append(f"{icons.get(o.status,'•')} `{o.order_number}` — ${float(o.total):.2f} — _{o.status}_")
        text = "\n".join(lines)

    kb = inline([[("🛍 Browse Products", "products_0"), ("🏠 Menu", "menu")]])
    if msg_id:
        edit(chat_id, msg_id, text, kb)
    else:
        send(chat_id, text, kb)


# ──────────────────────── Checkout + payment flow ─────────────────────────────

def do_checkout(chat_id: int, msg_id: int, first_name: str, last_name: str):
    """Called when user taps Pay Now.
    Bakong mode: generates a unique KHQR QR per order, polls until paid, notifies admin.
    """
    edit(chat_id, msg_id, "⏳ Creating your order...")

    try:
        with app.app_context():
            user = get_or_create_tg_user(chat_id, first_name, last_name)
            order, qr_data = create_pending_order(chat_id, user)
    except Exception as exc:
        edit(chat_id, msg_id, f"❌ *Order failed:* {exc}",
             inline([[("🔄 Try Again", "checkout"), ("🏠 Menu", "menu")]]))
        return

    delete_msg(chat_id, msg_id)

    try:
        qr_image = make_qr_image(qr_data["qr_string"])
        caption = (
            f"📱 *Scan to Pay — KHQR*\n\n"
            f"Order: `{order.order_number}`\n"
            f"Amount: *${float(order.total):.2f} USD*\n\n"
            f"Open *ABA*, *Wing Bank*, or any KHQR app and scan.\n\n"
            f"✅ Payment is detected automatically after scanning.\n"
            f"If not detected within 1 minute, tap *I've Paid* below.\n\n"
            f"⏰ _Expires in 10 minutes._"
        )
        result = send_photo(chat_id, qr_image, caption,
                            kb=inline([
                                [("✅ I've Paid", f"paid_confirm_{order.id}")],
                                [("❌ Cancel Order", f"cancel_order_{order.id}")],
                            ]))
    except Exception as exc:
        result = send(chat_id, f"❌ Failed to generate QR: {exc}")
        return

    status_msg_id = result.get("result", {}).get("message_id", 0)
    pending_payments[order.id] = {
        "chat_id": chat_id,
        "msg_id": status_msg_id,
        "qr_md5": qr_data["qr_md5"],
    }
    start_payment_poller(order.id, chat_id, status_msg_id, qr_data["qr_md5"])


# ──────────────────────── Update handlers ─────────────────────────────────────

def handle_message(msg: dict):
    chat_id  = msg["chat"]["id"]
    text     = msg.get("text", "").strip()
    from_u   = msg.get("from", {})
    first    = from_u.get("first_name", "")
    last     = from_u.get("last_name", "")
    username = from_u.get("username", "")

    with app.app_context():
        get_or_create_tg_user(chat_id, first, last)

    if chat_id in awaiting_contact and msg.get("photo"):
        awaiting_contact.discard(chat_id)
        full_name = f"{first} {last}".strip() or f"Telegram user {chat_id}"
        display_name = f"{full_name} (@{username})" if username else f"{full_name} (chat_id {chat_id})"
        caption = msg.get("caption", "").strip()
        file_id = msg["photo"][-1]["file_id"]
        try:
            img_bytes = download_telegram_file(file_id, BOT_TOKEN)
        except Exception as exc:
            print(f"[BOT] Failed to download contact photo: {exc}", flush=True)
            send(chat_id, "❌ Couldn't process that image. Please try again.")
            return
        with app.app_context():
            from extensions import db
            from models.contact_message import ContactMessage
            db.session.add(ContactMessage(
                name=display_name,
                email=f"tg_{chat_id}@gmstore.local",
                subject="Telegram bot contact message (photo)",
                message=caption or "[Photo attached — sent directly to admin Telegram]",
            ))
            db.session.commit()
        notify_admin_of_contact_photo(chat_id, full_name, username, img_bytes, caption)
        send(chat_id, "✅ Your photo has been sent to the admin. They'll get back to you soon.",
             inline([[("🏠 Menu", "menu")]]))
        return

    if chat_id in awaiting_contact and text and not text.startswith("/"):
        awaiting_contact.discard(chat_id)
        full_name = f"{first} {last}".strip() or f"Telegram user {chat_id}"
        display_name = f"{full_name} (@{username})" if username else f"{full_name} (chat_id {chat_id})"
        with app.app_context():
            from extensions import db
            from models.contact_message import ContactMessage
            db.session.add(ContactMessage(
                name=display_name,
                email=f"tg_{chat_id}@gmstore.local",
                subject="Telegram bot contact message",
                message=text,
            ))
            db.session.commit()
        notify_admin_of_contact(chat_id, full_name, username, text)
        send(chat_id, "✅ Your message has been sent to the admin. They'll get back to you soon.",
             inline([[("🏠 Menu", "menu")]]))
        return

    if text in ("/start", "/menu"):
        show_menu(chat_id, first)
    elif text == "/products":
        show_products(chat_id)
    elif text == "/cart":
        show_cart(chat_id)
    elif text == "/orders":
        with app.app_context():
            user = get_or_create_tg_user(chat_id, first, last)
        show_orders(chat_id, user.id)
    elif text == "/contact":
        awaiting_contact.add(chat_id)
        send(chat_id,
             "📩 *Contact Admin*\n\n"
             "Type a message or send a photo — it'll go straight to the GM Store admin.",
             inline([[("❌ Cancel", "menu")]]))
    elif text == "/help":
        send(chat_id,
             "📖 *GM Store Bot — Commands*\n\n"
             "/start — Main menu\n"
             "/products — Browse products\n"
             "/cart — View your cart\n"
             "/orders — Your order history\n"
             "/help — This message\n\n"
             "Use the *Contact Admin* button on the menu to message the admin directly.\n\n"
             "_Credentials are sent here in Telegram once the admin confirms delivery._")
    else:
        show_menu(chat_id, first)


def handle_callback(cb: dict):
    cb_id  = cb["id"]
    msg    = cb["message"]
    chat_id = msg["chat"]["id"]
    msg_id  = msg["message_id"]
    data    = cb.get("data", "")
    from_u  = cb.get("from", {})
    first   = from_u.get("first_name", "")
    last    = from_u.get("last_name", "")

    answer_cb(cb_id)

    with app.app_context():
        user = get_or_create_tg_user(chat_id, first, last)

    if data == "menu":
        awaiting_contact.discard(chat_id)
        show_menu(chat_id, first, msg_id)

    elif data.startswith("products_"):
        show_products(chat_id, msg_id, int(data.split("_", 1)[1]))

    elif data.startswith("view_"):
        show_product_detail(chat_id, msg_id, int(data.split("_", 1)[1]))

    elif data.startswith("add_"):
        product_id = int(data.split("_", 1)[1])
        with app.app_context():
            from models.product import Product
            p = Product.query.get(product_id)
            is_available = p.is_available if p else False

        if not p or not is_available:
            answer_cb(cb_id, "❌ Not available!", alert=True)
            return

        existing_qty = next((i["qty"] for i in carts.get(chat_id, []) if i["product_id"] == p.id), 0)
        if existing_qty >= MAX_ON_DEMAND_QTY:
            answer_cb(cb_id, f"❌ Max {MAX_ON_DEMAND_QTY} per order.", alert=True)
            return

        cart_add(chat_id, p.id, p.title, float(p.price))
        total_items = sum(i["qty"] for i in carts.get(chat_id, []))
        edit(chat_id, msg_id,
             f"✅ *{p.title}* added!\n\n"
             f"🛒 {total_items} item(s) — Total: *${cart_total(chat_id):.2f}*",
             inline([
                 [("🛒 View Cart", "cart"), ("🛍 Keep Shopping", "products_0")],
                 [("✅ Checkout Now", "checkout")],
             ]))

    elif data == "cart":
        show_cart(chat_id, msg_id)

    elif data == "clear_cart":
        carts.pop(chat_id, None)
        edit(chat_id, msg_id, "🗑 Cart cleared.",
             inline([[("🛍 Browse Products", "products_0"), ("🏠 Menu", "menu")]]))

    elif data == "checkout":
        cart = carts.get(chat_id, [])
        if not cart:
            edit(chat_id, msg_id, "🛒 Your cart is empty.",
                 inline([[("🛍 Browse Products", "products_0")]]))
            return
        edit(chat_id, msg_id,
             f"📋 *Order Summary*\n\n{cart_summary(chat_id)}\n\n"
             f"{'💳 Tap *Pay Now* — a KHQR code will appear for you to scan.' if PAYMENT_MODE != 'mock' else '💳 Tap *Pay Now* to confirm.'}\n"
             "_Credentials are sent here once the admin confirms delivery._",
             inline([
                 [("💳 Pay Now", "confirm_pay")],
                 [("❌ Cancel", "cart")],
             ]))

    elif data == "confirm_pay":
        do_checkout(chat_id, msg_id, first, last)

    elif data.startswith("paid_confirm_"):
        order_id = int(data.split("_", 2)[2])
        try:
            with app.app_context():
                from services.order_service import mark_order_paid
                import random as _r
                mark_order_paid(
                    order_id,
                    provider_txn_id=f"TG-{_r.randint(10000000, 99999999)}",
                    raw_response={"source": "telegram", "confirmed_by": "user"},
                )
            pending_payments.pop(order_id, None)
            carts.pop(chat_id, None)
            # Edit the QR photo caption isn't possible; send a new message
            send(chat_id,
                "✅ *Payment submitted!*\n\n"
                "Your order is now pending admin approval.\n"
                "You will receive your account credentials here once the admin confirms.\n\n"
                "⏳ _Usually within a few minutes._",
                inline([[("📦 My Orders", "orders"), ("🏠 Menu", "menu")]]))
        except Exception as exc:
            import traceback; traceback.print_exc()
            send(chat_id, f"❌ *Failed to submit:* {exc}\n\nPlease try again.",
                 inline([[("🔄 Try Again", f"paid_confirm_{order_id}")]]))

    elif data.startswith("cancel_order_"):
        order_id = int(data.split("_", 2)[2])
        try:
            with app.app_context():
                from services.inventory_service import cancel_order
                cancel_order(order_id)
            pending_payments.pop(order_id, None)
            edit(chat_id, msg_id, "❌ Order cancelled. Your cart items are still saved.",
                 inline([[("🛒 My Cart", "cart"), ("🏠 Menu", "menu")]]))
        except Exception as exc:
            edit(chat_id, msg_id, f"Could not cancel: {exc}")

    elif data == "orders":
        show_orders(chat_id, user.id, msg_id)

    elif data == "contact_admin":
        awaiting_contact.add(chat_id)
        edit(chat_id, msg_id,
             "📩 *Contact Admin*\n\n"
             "Type a message or send a photo — it'll go straight to the GM Store admin.",
             inline([[("❌ Cancel", "menu")]]))

    elif data == "help":
        edit(chat_id, msg_id,
             "📖 *GM Store Bot Help*\n\n"
             "🛍 *Browse* — View available game accounts\n"
             "🛒 *Cart* — Add items before buying\n"
             f"💳 *Pay Now* — {'KHQR QR code sent; scan with ABA/Wing' if PAYMENT_MODE != 'mock' else 'Confirm to submit payment'}\n"
             "📦 *Orders* — View your purchase history\n\n"
             "_Credentials are sent here in Telegram once the admin confirms delivery._",
             inline([[("🏠 Menu", "menu")]]))


# ────────────────────────── Polling loop ──────────────────────────────────────

def setup_commands():
    """Register the / command list and enable the commands menu button for private chats (user type)."""
    _post("setMyCommands", commands=[
        {"command": "start", "description": "Open the main menu"},
        {"command": "products", "description": "Browse products"},
        {"command": "cart", "description": "View your cart"},
        {"command": "orders", "description": "View your order history"},
        {"command": "contact", "description": "Send a message to the admin"},
        {"command": "help", "description": "Show help"},
    ], scope={"type": "default"})
    _post("setChatMenuButton", menu_button={"type": "commands"})


def run():
    print(f"[BOT] @autosale16_bot starting (payment mode: {PAYMENT_MODE})...", flush=True)
    _post("deleteWebhook", drop_pending_updates=True)
    setup_commands()
    threading.Thread(target=admin_bot_poll_loop, daemon=True).start()
    print("[BOT] Polling for updates. Send /start to @autosale16_bot.", flush=True)

    offset = 0
    while True:
        try:
            r = requests.get(
                f"{API}/getUpdates",
                params={"offset": offset, "timeout": 30,
                        "allowed_updates": ["message", "callback_query"]},
                timeout=35,
            )
            for update in r.json().get("result", []):
                offset = update["update_id"] + 1
                try:
                    if "message" in update:
                        handle_message(update["message"])
                    elif "callback_query" in update:
                        handle_callback(update["callback_query"])
                except Exception as exc:
                    import traceback
                    print(f"[BOT] Handler error: {exc}", flush=True)
                    traceback.print_exc()
        except Exception as exc:
            print(f"[BOT] Poll error: {exc} — retrying in 5s", flush=True)
            time.sleep(5)


if __name__ == "__main__":
    run()
