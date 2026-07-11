export default function StatusBadge({ product }) {
  const { status, is_available } = product

  if (status === 'coming_soon') {
    return <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">Coming Soon</span>
  }
  if (status === 'active' && !is_available) {
    return <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">Not Available</span>
  }
  if (product.is_featured || product.sold_count > 0) {
    return (
      <span className="rounded-full bg-gradient-to-r from-violet-500/30 to-emerald-500/30 px-2.5 py-0.5 text-xs font-medium text-violet-300">
        Best Sale
      </span>
    )
  }
  if (status === 'active' && is_available) {
    return <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">Available</span>
  }
  return null
}
