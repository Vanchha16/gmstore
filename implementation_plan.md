# On-demand / backorder stock feature

Decisions locked in with user:
- Trigger: automatic for any **active** product once `available_stock == 0` (no per-product toggle).
- New `orders.status` value `awaiting_stock` — order is paid, sits here while admin sources
  the item, separate from the normal `paid` (stock attached, awaiting delivery) state.
- Admin resolves the queue by doing what they'd do anyway: adding new stock via the existing
  Stock page. Newly added stock auto-claims the oldest `awaiting_stock` orders for that
  product (FIFO), flipping them to `paid` once fully stocked — normal Deliver flow takes over
  from there.
- Fallback if admin can't source it: manual cancel (reuses the refund-to-wallet system), no
  auto-timeout.
- Customer sees a simple badge ("Sourced on demand — delivery may take longer") instead of
  the current hard "Sold Out" block.

## Backend

1. `models/order.py` — add `"awaiting_stock"` to `status` Enum. Migration.
2. `services/inventory_service.py` — new `reserve_or_await_stock(product_id, qty)`:
   locks and reserves whatever's available (0..qty), returns `(reserved_items, missing_qty)`
   instead of raising when short.
3. `services/order_service.py`:
   - `create_order_from_cart`: for non-preorder items, use `reserve_or_await_stock`; create
     normal `OrderItem`s for reserved stock, and `stock_item_id=None` rows for the shortfall
     (same pattern already used for preorders).
   - `Order.needs_sourcing` — any item has `stock_item_id is None` and order isn't `is_preorder`.
   - `mark_order_paid`: set `status = "awaiting_stock"` instead of `"paid"` when
     `needs_sourcing`, otherwise unchanged.
   - `try_fulfill_awaiting_orders(product_id)`: FIFO-claims newly available stock for
     `awaiting_stock` orders' unlinked items (oldest order first); flips an order to `paid`
     once every item has stock; emails the buyer "your item is ready, awaiting delivery".
4. `blueprints/admin/stock.py` — after `adminAddStock` inserts new rows, call
   `try_fulfill_awaiting_orders(product_id)`.
5. `blueprints/cart.py` — drop the hard `available_stock` block for **active** products
   (keep it for anything else); still cap at a sane max qty.
6. `blueprints/admin/orders.py` — allow `awaiting_stock` in `update_order`'s status set and
   in `refund_order`'s refundable-from set (cancel + wallet refund path).

## Frontend

7. `StatusBadge.jsx` — active + 0 stock renders "Sourced on Demand" (amber) instead of the
   red blocking "Sold Out" pill.
8. `ProductDetail.jsx` — show Add-to-Cart (capped qty) + a short wait-time note instead of
   hiding the button at 0 stock.
9. `Checkout.jsx` — confirmation note when the cart contains an on-demand item.
10. `admin/Orders.jsx` — "Awaiting Stock" filter option; queue shows item needing sourcing.
11. `admin/Stock.jsx` — small "N orders waiting" indicator per product (nice-to-have).

## Test plan

API-level: create an order for a 0-stock active product → confirm payment lands it on
`awaiting_stock` (not `paid`), no stock attached. Admin adds stock for that product → confirm
it auto-claims and flips the order to `paid`. Admin cancels an `awaiting_stock` order →
confirm wallet refund fires. Confirm normal in-stock checkout is completely unaffected.
