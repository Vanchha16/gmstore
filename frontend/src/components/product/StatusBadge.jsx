export default function StatusBadge({ product }) {
  const { status, available_stock } = product

  if (status === 'coming_soon') {
    return <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">Coming Soon</span>
  }
  if (status === 'active' && available_stock === 0) {
    return <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">Sold Out</span>
  }
  if (product.is_featured || product.sold_count > 0) {
    return (
      <span className="rounded-full bg-gradient-to-r from-violet-500/30 to-emerald-500/30 px-2.5 py-0.5 text-xs font-medium text-violet-300">
        Best Sale
      </span>
    )
  }
  return null
}
