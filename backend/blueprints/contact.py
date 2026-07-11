import re
from flask import Blueprint, jsonify, request
from extensions import db
from models.contact_message import ContactMessage

contact_bp = Blueprint("contact", __name__, url_prefix="/api/v1/contact")


@contact_bp.post("")
def submit_contact():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    subject = data.get("subject", "").strip()
    message = data.get("message", "").strip()

    if not name or not email or not subject or not message:
        return jsonify({"error": "All fields (name, email, subject, message) are required."}), 400

    # Basic email validation
    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return jsonify({"error": "Please enter a valid email address."}), 400

    # Phone is optional, but validate format if the user typed one in
    if phone and not re.match(r"^[0-9+()\-\s]{6,30}$", phone):
        return jsonify({"error": "Please enter a valid phone number."}), 400

    new_msg = ContactMessage(
        name=name,
        email=email,
        phone=phone or None,
        subject=subject,
        message=message
    )
    db.session.add(new_msg)
    db.session.commit()

    # Send notification email to admin copy
    try:
        from flask_mail import Message as MailMessage
        from extensions import mail
        from flask import current_app

        admin_email = current_app.config.get("MAIL_USERNAME")
        if admin_email:
            msg = MailMessage(
                subject=f"GM Store Contact: {subject}",
                recipients=[admin_email],
                body=(
                    f"You have received a new contact message on GM Store.\n\n"
                    f"Name: {name}\n"
                    f"Email: {email}\n"
                    f"Phone: {phone or '—'}\n\n"
                    f"Subject: {subject}\n"
                    f"Message:\n{message}"
                )
            )
            mail.send(msg)
    except Exception as e:
        print(f"Error sending contact notification email: {e}")

    return jsonify({"message": "Your message has been sent successfully."}), 201
