from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from models.product import Product
from models.category import Category

products_bp = Blueprint("products", __name__, url_prefix="/api/v1/products")

BEST_SALE_LIMIT = 20


def _active_base():
    return Product.query.filter(Product.deleted_at.is_(None))


def _serialize_list(products, include_stock=True):
    return [p.to_dict(include_stock=include_stock) for p in products]


def _paginate(q, page, limit):
    page = max(1, page)
    limit = min(max(1, limit), 100)
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return items, total, page, limit


# GET /api/v1/products
@products_bp.get("")
def list_products():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    q_str = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    ptype = request.args.get("type", "").strip()
    min_price = request.args.get("min")
    max_price = request.args.get("max")
    sort = request.args.get("sort", "newest")

    q = _active_base().filter(Product.status != "archived")

    if q_str:
        q = q.filter(or_(Product.title.ilike(f"%{q_str}%"), Product.description.ilike(f"%{q_str}%")))
    if category:
        q = q.join(Category).filter(Category.slug == category)
    if ptype in ("account", "game_key"):
        q = q.filter(Product.product_type == ptype)
    if min_price:
        q = q.filter(Product.price >= float(min_price))
    if max_price:
        q = q.filter(Product.price <= float(max_price))

    if sort == "price_asc":
        q = q.order_by(Product.price.asc())
    elif sort == "price_desc":
        q = q.order_by(Product.price.desc())
    elif sort == "best_sale":
        q = q.order_by(Product.sold_count.desc())
    else:
        q = q.order_by(Product.created_at.desc())

    items, total, page, limit = _paginate(q, page, limit)
    return jsonify({"items": _serialize_list(items), "total": total, "page": page, "limit": limit}), 200


# GET /api/v1/products/best-sale
@products_bp.get("/best-sale")
def best_sale():
    q = _active_base().filter(
        Product.status == "active",
        or_(Product.is_featured.is_(True), Product.sold_count > 0)
    ).order_by(Product.is_featured.desc(), Product.sold_count.desc()).limit(BEST_SALE_LIMIT)
    return jsonify(_serialize_list(q.all())), 200


# GET /api/v1/products/coming-soon
@products_bp.get("/coming-soon")
def coming_soon():
    q = _active_base().filter(Product.status == "coming_soon").order_by(Product.release_date.asc())
    return jsonify(_serialize_list(q.all(), include_stock=False)), 200


# GET /api/v1/products/sold-out
@products_bp.get("/sold-out")
def sold_out():
    from models.stock_item import StockItem
    from sqlalchemy import func, select
    # subquery: product ids with at least one available stock item
    has_stock = select(StockItem.product_id).where(StockItem.status == "available").distinct()
    q = _active_base().filter(
        Product.status == "active",
        Product.id.not_in(has_stock)
    ).order_by(Product.updated_at.desc())
    return jsonify(_serialize_list(q.all(), include_stock=True)), 200


# GET /api/v1/products/<slug>
@products_bp.get("/<slug>")
def product_detail(slug):
    product = _active_base().filter_by(slug=slug).first_or_404()
    data = product.to_dict(include_stock=True)
    return jsonify(data), 200


# GET /api/v1/categories
@products_bp.get("/categories")
def list_categories():
    cats = Category.query.order_by(Category.name).all()
    return jsonify([c.to_dict() for c in cats]), 200
