from flask import Blueprint, request, jsonify
from extensions import db
from models.order import Order
from services.order_service import fulfill_order
from services.payway_service import verify_callback_signature

payway_payment_bp = Blueprint("payway_payment", __name__, url_prefix="/api/v1/payment/payway")


@payway_payment_bp.post("/callback")
def payway_callback():
    """
    Server-to-server pushback endpoint called by ABA PayWay.
    """
    # ABA PayWay typically POSTs form data, but might send JSON
    payload = request.form.to_dict() if request.form else (request.get_json(silent=True) or {})
    
    tran_id = payload.get("tran_id")
    status = payload.get("status")
    amount = payload.get("amount")
    aprov_code = payload.get("aprov_code")
    signature = payload.get("hash")

    if not tran_id or status is None or signature is None:
        return jsonify({"error": "Missing mandatory pushback fields."}), 400

    # Verify signature using payway API secret key
    is_valid = verify_callback_signature(payload, signature)
    if not is_valid:
        return jsonify({"error": "Invalid HMAC signature."}), 401

    # ABA status '0' means transaction was successful
    if str(status) == "0":
        order = Order.query.filter_by(order_number=tran_id).first()
        if not order:
            return jsonify({"error": f"Order {tran_id} not found."}), 404
            
        try:
            fulfill_order(order.id, provider_txn_id=aprov_code or "ABA-TXN-OK", raw_response=payload)
            # ABA PayWay expectations: return 'OK' or JSON acknowledging success
            return jsonify({"status": 0, "message": "Order fulfilled successfully."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Order fulfillment failed: {str(e)}"}), 500

    return jsonify({"status": status, "message": "Transaction was not successful."}), 200
