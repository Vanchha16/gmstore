import { useState, useEffect } from 'react'
import { getUserPreorders, cancelPreorder } from '../../api/endpoints'
import AccountLayout from './AccountLayout'
import { Link } from 'react-router-dom'

export default function Preorders() {
  const [preorders, setPreorders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPreorders()
  }, [])

  const fetchPreorders = () => {
    getUserPreorders()
      .then(({ data }) => setPreorders(data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }

  const handleCancel = async (productId) => {
    if (!confirm('Are you sure you want to cancel this pre-order?')) return
    try {
      await cancelPreorder(productId)
      setPreorders(preorders.filter((po) => po.product_id !== productId))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel pre-order.')
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'waiting':
        return (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
            Waiting for Release
          </span>
        )
      case 'notified':
        return (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            Released / Ready
          </span>
        )
      case 'converted':
        return (
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 border border-blue-500/20">
            Claimed
          </span>
        )
      default:
        return (
          <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-400 border border-slate-500/20">
            {status}
          </span>
        )
    }
  }

  return (
    <AccountLayout>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Pre-orders</h2>
        <span className="rounded-full bg-violet-600/20 px-3 py-1 text-xs font-semibold text-violet-400">
          {preorders.length} active
        </span>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex py-12 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent"></div>
        </div>
      ) : preorders.length === 0 ? (
        <div className="py-12 text-center">
          <span className="mb-3 block text-4xl">🕐</span>
          <h3 className="mb-1 text-lg font-semibold text-slate-300">No pre-orders</h3>
          <p className="text-sm text-slate-500">Pre-ordered Coming Soon games will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {preorders.map((po) => {
            const product = po.product
            if (!product) return null
            const primaryImage = product.images?.find((i) => i.is_primary) || product.images?.[0]

            return (
              <div
                key={po.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                    {primaryImage ? (
                      <img src={primaryImage.url} alt={product.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-700 text-xs">No Img</div>
                    )}
                  </div>
                  <div>
                    <Link to={`/products/${product.slug}`} className="font-semibold text-slate-200 hover:text-violet-400">
                      {product.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>Price: <strong className="text-slate-200">${product.price.toFixed(2)}</strong></span>
                      {product.release_date && (
                        <span>Release: {new Date(product.release_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  {getStatusBadge(po.status)}
                  {po.status === 'waiting' && (
                    <button
                      onClick={() => handleCancel(po.product_id)}
                      className="rounded-xl border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AccountLayout>
  )
}
