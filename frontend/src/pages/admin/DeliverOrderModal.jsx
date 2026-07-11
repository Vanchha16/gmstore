import { useEffect, useState } from 'react'
import { adminGetDeliverable, adminDeliverOrder } from '../../api/endpoints'
import { useToast } from '../../context/ToastContext'

function ItemResolver({ item, info, resolution, onChange }) {
  const hasExisting = (info?.available_stock || []).length > 0
  const mode = resolution?.mode || (hasExisting ? 'existing' : 'manual')

  const setMode = (nextMode) => onChange({ ...resolution, mode: nextMode })
  const setField = (field, value) => onChange({ ...resolution, mode, [field]: value })

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-200">{item.title_snapshot}</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('existing')}
          disabled={!hasExisting}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed ${
            mode === 'existing' ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          Pick existing stock {hasExisting ? `(${info.available_stock.length})` : '(none)'}
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            mode === 'manual' ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          Enter manually
        </button>
      </div>

      {mode === 'existing' ? (
        <select
          value={resolution?.stock_item_id || ''}
          onChange={(e) => setField('stock_item_id', e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
        >
          <option value="">— select a stock item —</option>
          {(info?.available_stock || []).map((s) => (
            <option key={s.id} value={s.id}>
              #{s.id} · added {new Date(s.created_at + 'Z').toLocaleString()}
            </option>
          ))}
        </select>
      ) : info?.product_type === 'account' ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Username"
            value={resolution?.username || ''}
            onChange={(e) => setField('username', e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
          <input
            placeholder="Password"
            value={resolution?.password || ''}
            onChange={(e) => setField('password', e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>
      ) : (
        <input
          placeholder="Game key"
          value={resolution?.key || ''}
          onChange={(e) => setField('key', e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
      )}
    </div>
  )
}

export default function DeliverOrderModal({ orderId, onClose, onDelivered }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState(null)
  const [itemsInfo, setItemsInfo] = useState({})
  const [resolutions, setResolutions] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    adminGetDeliverable(orderId)
      .then(({ data }) => {
        setOrder(data.order)
        setItemsInfo(data.items_needing_delivery || {})
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load delivery info.'))
      .finally(() => setLoading(false))
  }, [orderId])

  const unresolvedItems = (order?.items || []).filter((i) => !i.stock_item_id)

  const submit = async () => {
    setError('')
    const resolutionPayload = {}
    for (const item of unresolvedItems) {
      const r = resolutions[item.id]
      if (!r) { setError(`Resolve "${item.title_snapshot}" before delivering.`); return }
      if (r.mode === 'existing') {
        if (!r.stock_item_id) { setError(`Pick a stock item for "${item.title_snapshot}".`); return }
        resolutionPayload[item.id] = { stock_item_id: Number(r.stock_item_id) }
      } else {
        const productType = itemsInfo[item.id]?.product_type
        if (productType === 'account') {
          if (!r.username?.trim() || !r.password?.trim()) {
            setError(`Enter username and password for "${item.title_snapshot}".`)
            return
          }
          resolutionPayload[item.id] = { manual: { username: r.username.trim(), password: r.password.trim() } }
        } else {
          if (!r.key?.trim()) { setError(`Enter a key for "${item.title_snapshot}".`); return }
          resolutionPayload[item.id] = { manual: { key: r.key.trim() } }
        }
      }
    }

    setSubmitting(true)
    try {
      const { data } = await adminDeliverOrder(orderId, resolutionPayload)
      toast('Order delivered to buyer.', 'success')
      onDelivered(data.order)
    } catch (err) {
      setError(err.response?.data?.error || 'Delivery failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-slate-100">Deliver Order</h2>
        <p className="mt-1 text-xs text-slate-500">
          Resolve each item below — pick an existing stock item, or source the account/key yourself and type it in.
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {unresolvedItems.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing left to resolve — this order is ready to finalize.</p>
            ) : (
              unresolvedItems.map((item) => (
                <ItemResolver
                  key={item.id}
                  item={item}
                  info={itemsInfo[item.id]}
                  resolution={resolutions[item.id]}
                  onChange={(next) => setResolutions((prev) => ({ ...prev, [item.id]: next }))}
                />
              ))
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || submitting}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
          >
            {submitting ? 'Delivering…' : 'Deliver'}
          </button>
        </div>
      </div>
    </div>
  )
}
