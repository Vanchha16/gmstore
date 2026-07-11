// "paid" means payment confirmed but not yet delivered by admin — surfaced to
// everyone (buyer and admin) as "Pending Delivery" rather than the raw enum value.
const LABELS = {
  pending_payment: 'Pending Payment',
  paid: 'Pending Delivery',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  failed: 'Failed',
}

export function formatOrderStatus(status) {
  return LABELS[status] || (status || '').replace(/_/g, ' ')
}
