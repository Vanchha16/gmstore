import os
import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from extensions import db
from models.product import Product, ProductImage
from models.category import Category
from utils.decorators import role_required

admin_products_bp = Blueprint("admin_products", __name__, url_prefix="/api/v1/admin/products")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text)


def _unique_slug(base: str, exclude_id=None) -> str:
    slug = base
    n = 1
    while True:
        q = Product.query.filter_by(slug=slug)
        if exclude_id:
            q = q.filter(Product.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _upload_dir():
    d = os.path.join(current_app.root_path, "uploads")
    os.makedirs(d, exist_ok=True)
    return d


# GET /api/v1/admin/products
@admin_products_bp.get("")
@role_required("admin")
def list_products():
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    q = Product.query.filter(Product.deleted_at.is_(None)).order_by(Product.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return jsonify({"items": [p.to_dict(include_stock=True) for p in items], "total": total, "page": page, "limit": limit}), 200


# POST /api/v1/admin/products
@admin_products_bp.post("")
@role_required("admin")
def create_product():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required."}), 400

    slug = _unique_slug(_slugify(data.get("slug") or title))
    release_date = None
    if data.get("release_date"):
        try:
            release_date = datetime.fromisoformat(data["release_date"])
        except ValueError:
            return jsonify({"error": "Invalid release_date format."}), 400

    product = Product(
        title=title,
        slug=slug,
        description=data.get("description", ""),
        product_type=data.get("product_type", "game_key"),
        category_id=data.get("category_id"),
        price=float(data.get("price", 0)),
        compare_at_price=float(data["compare_at_price"]) if data.get("compare_at_price") else None,
        currency=data.get("currency", "USD"),
        status=data.get("status", "draft"),
        release_date=release_date,
        is_featured=bool(data.get("is_featured", False)),
        delivery_time=data.get("delivery_time") or None,
        rules=data.get("rules") or None,
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict(include_stock=True)), 201


# GET /api/v1/admin/products/<int:product_id>
@admin_products_bp.get("/<int:product_id>")
@role_required("admin")
def get_product(product_id):
    product = Product.query.filter_by(id=product_id, deleted_at=None).first_or_404()
    return jsonify(product.to_dict(include_stock=True)), 200


# PATCH /api/v1/admin/products/<int:product_id>
@admin_products_bp.patch("/<int:product_id>")
@role_required("admin")
def update_product(product_id):
    product = Product.query.filter_by(id=product_id, deleted_at=None).first_or_404()
    data = request.get_json(silent=True) or {}

    if "title" in data:
        product.title = data["title"].strip()
    if "slug" in data:
        product.slug = _unique_slug(_slugify(data["slug"]), exclude_id=product_id)
    if "description" in data:
        product.description = data["description"]
    if "product_type" in data:
        product.product_type = data["product_type"]
    if "category_id" in data:
        product.category_id = data["category_id"]
    if "price" in data:
        product.price = float(data["price"])
    if "compare_at_price" in data:
        product.compare_at_price = float(data["compare_at_price"]) if data["compare_at_price"] else None
    if "currency" in data:
        product.currency = data["currency"]
    if "status" in data:
        new_status = data["status"]
        old_status = product.status
        # Block setting active if no available stock
        if new_status == "active" and product.available_stock == 0 and data.get("force") != True:
            return jsonify({
                "error": "Cannot set product to active with 0 available stock. Add stock first, or pass force=true to override.",
                "available_stock": 0
            }), 400
        product.status = new_status
        # Notify waiting pre-orderers when a coming_soon product goes active
        if old_status == "coming_soon" and new_status == "active":
            from models.preorder import Preorder
            from models.user import User
            from services.mail_service import send_preorder_notification_email
            waiting = (
                Preorder.query
                .filter_by(product_id=product.id, status="waiting")
                .all()
            )
            for po in waiting:
                po.status = "notified"
                user = User.query.get(po.user_id)
                if user:
                    try:
                        send_preorder_notification_email(user, product)
                    except Exception as exc:
                        current_app.logger.warning("Preorder notify failed for user %s: %s", user.id, exc)
    if "release_date" in data:
        rd = data["release_date"]
        if rd:
            parsed = datetime.fromisoformat(rd)
            if parsed < datetime.now(timezone.utc).replace(tzinfo=None) and product.status == "coming_soon":
                return jsonify({"error": "Release date cannot be in the past for coming_soon products."}), 400
            product.release_date = parsed
        else:
            product.release_date = None
    if "is_featured" in data:
        product.is_featured = bool(data["is_featured"])
    if "delivery_time" in data:
        product.delivery_time = (data["delivery_time"] or "").strip() or None
    if "rules" in data:
        product.rules = (data["rules"] or "").strip() or None

    product.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(product.to_dict(include_stock=True)), 200


# DELETE /api/v1/admin/products/<int:product_id>  (soft delete)
@admin_products_bp.delete("/<int:product_id>")
@role_required("admin")
def delete_product(product_id):
    product = Product.query.filter_by(id=product_id, deleted_at=None).first_or_404()
    product.deleted_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"message": "Product deleted."}), 200


# POST /api/v1/admin/products/<int:product_id>/images
@admin_products_bp.post("/<int:product_id>/images")
@role_required("admin")
def upload_image(product_id):
    product = Product.query.filter_by(id=product_id, deleted_at=None).first_or_404()
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400
    file = request.files["file"]
    if not _allowed(file.filename):
        return jsonify({"error": "File type not allowed."}), 400

    filename = f"product_{product_id}_{int(datetime.now(timezone.utc).timestamp())}_{secure_filename(file.filename)}"
    file.save(os.path.join(_upload_dir(), filename))
    url = f"/uploads/{filename}"

    is_primary = not ProductImage.query.filter_by(product_id=product_id).first()
    sort_order = ProductImage.query.filter_by(product_id=product_id).count()
    img = ProductImage(product_id=product_id, url=url, sort_order=sort_order, is_primary=is_primary)
    db.session.add(img)
    db.session.commit()
    return jsonify(img.to_dict()), 201


# DELETE /api/v1/admin/products/images/<int:image_id>
@admin_products_bp.delete("/images/<int:image_id>")
@role_required("admin")
def delete_image(image_id):
    img = ProductImage.query.get_or_404(image_id)
    db.session.delete(img)
    db.session.commit()
    return jsonify({"message": "Image deleted."}), 200


# GET/POST /api/v1/admin/categories
@admin_products_bp.get("/categories")
@role_required("admin")
def list_categories():
    cats = Category.query.order_by(Category.name).all()
    return jsonify([c.to_dict() for c in cats]), 200


@admin_products_bp.post("/categories")
@role_required("admin")
def create_category():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required."}), 400
    slug = data.get("slug") or _slugify(name)
    if Category.query.filter_by(slug=slug).first():
        return jsonify({"error": "Slug already exists."}), 409
    cat = Category(name=name, slug=slug, icon_url=data.get("icon_url"))
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@admin_products_bp.patch("/categories/<int:cat_id>")
@role_required("admin")
def update_category(cat_id):
    cat = Category.query.get_or_404(cat_id)
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty."}), 400
        cat.name = name
        if "slug" not in data:
            new_slug = _slugify(name)
            existing = Category.query.filter(Category.slug == new_slug, Category.id != cat_id).first()
            if not existing:
                cat.slug = new_slug
    if "slug" in data:
        new_slug = _slugify(data["slug"])
        existing = Category.query.filter(Category.slug == new_slug, Category.id != cat_id).first()
        if existing:
            return jsonify({"error": "Slug already in use."}), 409
        cat.slug = new_slug
    db.session.commit()
    return jsonify(cat.to_dict()), 200


@admin_products_bp.delete("/categories/<int:cat_id>")
@role_required("admin")
def delete_category(cat_id):
    cat = Category.query.get_or_404(cat_id)
    in_use = Product.query.filter_by(category_id=cat_id, deleted_at=None).count()
    if in_use:
        return jsonify({"error": f"Cannot delete — {in_use} product(s) use this category."}), 409
    db.session.delete(cat)
    db.session.commit()
    return jsonify({"message": "Category deleted."}), 200
