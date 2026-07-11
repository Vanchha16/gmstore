import os
from flask import Flask, send_from_directory
from config import config_map
from extensions import db, migrate, jwt, mail, cors, socketio
from blueprints.health import health_bp
from blueprints.auth import auth_bp
from blueprints.me import me_bp
from blueprints.products import products_bp
from blueprints.admin.products import admin_products_bp
from blueprints.admin.stock import admin_stock_bp
from blueprints.favorites import favorites_bp
from blueprints.reviews import reviews_bp
from blueprints.preorders import preorders_bp
from blueprints.cart import cart_bp
from blueprints.checkout import checkout_bp
from blueprints.contact import contact_bp
from blueprints.admin.stats import admin_stats_bp
from blueprints.admin.messages import admin_messages_bp
from blueprints.admin.orders import admin_orders_bp
from blueprints.admin.users import admin_users_bp
from blueprints.payment_payway import payway_payment_bp
from blueprints.chat import chat_bp
from blueprints.wallet import wallet_bp
from blueprints.admin.wallets import admin_wallets_bp





def create_app(env: str | None = None) -> Flask:
    if env is None:
        env = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_map[env])

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}})

    # import all models so Alembic detects them
    from models import User, OtpCode, Category, Product, ProductImage, StockItem, Favorite, Review, Preorder, Cart, CartItem, Order, OrderItem, Payment, ContactMessage, ChatSession, ChatMessage, Wallet, WalletTransaction, WalletTopup  # noqa: F401

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(me_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(admin_products_bp)
    app.register_blueprint(admin_stock_bp)
    app.register_blueprint(favorites_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(preorders_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(checkout_bp)
    app.register_blueprint(contact_bp)
    app.register_blueprint(admin_stats_bp)
    app.register_blueprint(admin_messages_bp)
    app.register_blueprint(admin_orders_bp)
    app.register_blueprint(admin_users_bp)
    app.register_blueprint(payway_payment_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(wallet_bp)
    app.register_blueprint(admin_wallets_bp)

    socketio.init_app(app)

    # Background Scheduler to clean stale reservations periodically
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        from apscheduler.schedulers.background import BackgroundScheduler
        from services.inventory_service import release_stale_reservations

        scheduler = BackgroundScheduler()
        
        def run_cleanup():
            with app.app_context():
                try:
                    release_stale_reservations()
                except Exception as e:
                    app.logger.error("Failed to release stale reservations: %s", str(e))

        def run_coming_soon_flip():
            with app.app_context():
                try:
                    from datetime import datetime, timezone
                    from models.product import Product
                    from models.preorder import Preorder
                    from models.user import User
                    from services.mail_service import send_preorder_notification_email
                    now = datetime.now(timezone.utc).replace(tzinfo=None)
                    due = Product.query.filter(
                        Product.status == "coming_soon",
                        Product.release_date <= now,
                        Product.deleted_at.is_(None),
                    ).all()
                    for product in due:
                        product.status = "active"
                        waiting = Preorder.query.filter_by(product_id=product.id, status="waiting").all()
                        for po in waiting:
                            po.status = "notified"
                            user = User.query.get(po.user_id)
                            if user:
                                try:
                                    send_preorder_notification_email(user, product)
                                except Exception as exc:
                                    app.logger.warning("Preorder notify failed: %s", exc)
                    if due:
                        db.session.commit()
                        app.logger.info("Flipped %d product(s) from coming_soon to active", len(due))
                except Exception as e:
                    app.logger.error("Coming soon flip failed: %s", str(e))

        def run_bakong_payment_sweep():
            with app.app_context():
                try:
                    from models.order import Order
                    from services.order_service import check_and_fulfill_bakong_order
                    pending = Order.query.filter_by(status="pending_payment").all()
                    for o in pending:
                        try:
                            check_and_fulfill_bakong_order(o.id)
                        except Exception as exc:
                            app.logger.warning("Bakong sweep failed for order %s: %s", o.id, exc)
                except Exception as e:
                    app.logger.error("Bakong payment sweep failed: %s", str(e))

        def run_wallet_topup_sweep():
            with app.app_context():
                try:
                    from models.wallet_topup import WalletTopup
                    from blueprints.wallet import _complete_topup
                    from services.payway_service import check_bakong_payment
                    pending = WalletTopup.query.filter_by(status="pending").all()
                    for t in pending:
                        try:
                            if t.qr_md5 and check_bakong_payment(t.qr_md5):
                                _complete_topup(t)
                        except Exception as exc:
                            app.logger.warning("Wallet top-up sweep failed for topup %s: %s", t.id, exc)
                except Exception as e:
                    app.logger.error("Wallet top-up sweep failed: %s", str(e))

        # Check every 60 seconds for stale stock holds
        scheduler.add_job(func=run_cleanup, trigger="interval", seconds=60)
        # Check every 5 minutes for coming_soon products whose release_date has passed
        scheduler.add_job(func=run_coming_soon_flip, trigger="interval", minutes=5)
        # Fallback: mark Bakong orders paid even if the buyer's browser tab isn't open/polling
        # (delivery still requires a separate admin confirmation — see services/order_service.py)
        scheduler.add_job(func=run_bakong_payment_sweep, trigger="interval", seconds=30)
        # Fallback: credit wallet top-ups even if the buyer's browser tab isn't open/polling
        scheduler.add_job(func=run_wallet_topup_sweep, trigger="interval", seconds=30)
        scheduler.start()


    # serve uploaded images
    uploads_dir = os.path.join(app.root_path, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(uploads_dir, filename)

    return app


if __name__ == "__main__":
    app = create_app()
    socketio.run(app, port=5000, debug=True, allow_unsafe_werkzeug=True)
