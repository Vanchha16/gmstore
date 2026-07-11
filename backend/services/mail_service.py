import urllib.request
import urllib.parse
import json as _json

from flask import current_app
from flask_mail import Message
from extensions import mail


def send_telegram_notification(order):
    token = current_app.config.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = current_app.config.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return

    frontend_origin = current_app.config.get("FRONTEND_ORIGIN", "http://localhost:5173")
    admin_link = f"{frontend_origin}/admin/orders/{order.id}"
    items_text = "\n".join(
        f"  • {i.title_snapshot} x{i.qty}  ${float(i.unit_price):.2f}" for i in order.items
    )
    def _esc(s):
        import html
        return html.escape(str(s))

    text = (
        f"🛒 <b>New Paid Order!</b>\n\n"
        f"📋 Order: <code>{_esc(order.order_number)}</code>\n"
        f"👤 Customer: {_esc(order.user.full_name)} ({_esc(order.user.email)})\n"
        f"💰 Total: ${float(order.total):.2f}\n\n"
        f"<b>Items:</b>\n{_esc(items_text)}\n\n"
        f"🔗 <a href=\"{_esc(admin_link)}\">View in Admin Panel</a>"
    )
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = _json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }).encode()
    try:
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5)
        print(f"[TELEGRAM] Notification sent for {order.order_number}", flush=True)
    except Exception as exc:
        current_app.logger.warning("Telegram notification failed: %s", exc)


def send_otp_email(to_email: str, full_name: str, code: str, purpose: str):
    # Log the OTP directly to the terminal for easy copy-paste in local dev environments
    print(f"\n=========================================\n[DEV MAIL] OTP Code for {to_email} ({purpose}): {code}\n=========================================\n", flush=True)
    
    # Skip actual SMTP sending if SMTP settings are dummy/unconfigured to avoid timeouts
    mail_username = current_app.config.get("MAIL_USERNAME")
    if not mail_username or mail_username == "your@gmail.com":
        print("[DEV MAIL] SMTP email skipped because MAIL_USERNAME is unconfigured.", flush=True)
        return
        
    subject = "Your GM Store verification code" if purpose == "register" else "GM Store password reset code"
    body = (
        f"Hi {full_name},\n\n"
        f"Your one-time code is: {code}\n\n"
        f"It expires in 10 minutes. Do not share it with anyone.\n\n"
        f"— GM Store"
    )
    msg = Message(subject=subject, recipients=[to_email], body=body)
    try:
        mail.send(msg)
    except Exception as exc:
        current_app.logger.warning("Mail send failed: %s", exc)


def send_preorder_notification_email(user, product):
    mail_username = current_app.config.get("MAIL_USERNAME")
    print(
        f"\n[DEV MAIL] Preorder notification for {user.email}: '{product.title}' is now available.\n",
        flush=True
    )
    if not mail_username or mail_username == "your@gmail.com":
        return
    subject = f"'{product.title}' is now available on GM Store!"
    body = (
        f"Hi {user.full_name},\n\n"
        f"Great news! The product you pre-ordered is now available:\n\n"
        f"  {product.title} — ${float(product.price):.2f}\n\n"
        f"Head to GM Store to complete your purchase:\n"
        f"  /products/{product.slug}\n\n"
        f"— GM Store"
    )
    msg = Message(subject=subject, recipients=[user.email], body=body)
    try:
        mail.send(msg)
    except Exception as exc:
        current_app.logger.warning("Preorder notification mail failed: %s", exc)


def send_order_paid_admin_notification(order):
    admin_email = current_app.config.get("ADMIN_EMAIL", "")
    if not admin_email:
        return

    frontend_origin = current_app.config.get("FRONTEND_ORIGIN", "http://localhost:5173")
    admin_link = f"{frontend_origin}/admin/orders/{order.id}"
    items_text = "\n".join(
        f"  - {i.title_snapshot} x{i.qty}  ${float(i.unit_price):.2f}" for i in order.items
    )
    print(
        f"\n[DEV MAIL] ORDER PAID — Admin notification\n"
        f"Order: {order.order_number}  Total: ${float(order.total):.2f}\n"
        f"Buyer: {order.user.full_name} <{order.user.email}>\n"
        f"Admin Email: {admin_email}\n"
        f"Items:\n{items_text}\n"
        f"Admin link: {admin_link}\n",
        flush=True,
    )

    mail_username = current_app.config.get("MAIL_USERNAME")
    if not mail_username or mail_username == "your@gmail.com":
        return

    subject = f"[GM Store] New paid order {order.order_number}"
    body = (
        f"A new order has been paid.\n\n"
        f"Order number : {order.order_number}\n"
        f"Customer     : {order.user.full_name} ({order.user.email})\n"
        f"Total        : ${float(order.total):.2f}\n\n"
        f"Items purchased:\n{items_text}\n\n"
        f"Review or confirm delivery in the admin panel:\n"
        f"  {admin_link}\n\n"
        f"— GM Store"
    )
    msg = Message(subject=subject, recipients=[admin_email], body=body)
    try:
        mail.send(msg)
    except Exception as exc:
        current_app.logger.warning("Admin order notification mail failed: %s", exc)


def send_telegram_delivery(order):
    """Send fulfilled credentials via the store bot if buyer is a Telegram user."""
    email = order.user.email or ""
    if not email.startswith("tg_") or not email.endswith("@gmstore.local"):
        return

    try:
        chat_id = int(email.split("_")[1].split("@")[0])
    except (IndexError, ValueError):
        return

    token = current_app.config.get("TELEGRAM_STORE_BOT_TOKEN", "")
    if not token:
        return

    from utils.security import decrypt_payload
    lines = [f"🎉 *Order {order.order_number} delivered!*\n\nHere are your credentials:\n"]
    for it in order.items:
        cred = "[unavailable]"
        if it.stock_item:
            try:
                cred = decrypt_payload(it.stock_item.secret_payload)
            except Exception:
                pass
        lines.append(f"🎮 *{it.title_snapshot}*\n`{cred}`")
    lines.append("\n_Thank you for shopping at GM Store!_")

    text = "\n\n".join(lines)
    print(f"[TELEGRAM] Sending delivery to chat {chat_id} for {order.order_number}", flush=True)
    try:
        import urllib.request, json as _json
        payload = _json.dumps({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as exc:
        current_app.logger.warning("Telegram delivery failed: %s", exc)


def send_delivery_email(order):
    mail_username = current_app.config.get("MAIL_USERNAME")
    if not mail_username or mail_username == "your@gmail.com":
        print(f"[DEV MAIL] Delivery email skipped for Order {order.order_number} because MAIL_USERNAME is unconfigured.", flush=True)
        return
        
    subject = f"Your GM Store Order {order.order_number} is ready!"
    
    items_text = ""
    for item in order.items:
        payload = ""
        if item.stock_item:
            from utils.security import decrypt_payload
            try:
                payload = decrypt_payload(item.stock_item.secret_payload)
            except Exception:
                payload = "[Encrypted Key]"
        items_text += f"- {item.title_snapshot}: {payload}\n"

    body = (
        f"Hi {order.user.full_name},\n\n"
        f"Thank you for your purchase! Your payment was successful.\n\n"
        f"Here are your items:\n"
        f"{items_text}\n"
        f"You can also access them in your Purchase History inside your profile.\n\n"
        f"— GM Store"
    )
    msg = Message(subject=subject, recipients=[order.user.email], body=body)
    try:
        mail.send(msg)
    except Exception as exc:
        current_app.logger.warning("Mail send failed: %s", exc)


def send_stock_ready_notification(order):
    """Order was awaiting_stock and just got fully restocked — let the buyer know it's queued for delivery."""
    mail_username = current_app.config.get("MAIL_USERNAME")
    if not mail_username or mail_username == "your@gmail.com":
        print(f"[DEV MAIL] Stock-ready email skipped for Order {order.order_number} because MAIL_USERNAME is unconfigured.", flush=True)
        return

    subject = f"Your GM Store Order {order.order_number} is sourced and ready!"
    body = (
        f"Hi {order.user.full_name},\n\n"
        f"Good news — the item(s) you ordered have been sourced and are ready.\n\n"
        f"Your order is now queued for delivery; you'll get your credentials as soon as "
        f"our admin confirms it (usually within a few hours).\n\n"
        f"— GM Store"
    )
    msg = Message(subject=subject, recipients=[order.user.email], body=body)
    try:
        mail.send(msg)
    except Exception as exc:
        current_app.logger.warning("Mail send failed: %s", exc)

