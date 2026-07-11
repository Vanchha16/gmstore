import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { adminListPromoCodes, adminCreatePromoCode, adminUpdatePromoCode, adminDeletePromoCode } from '../../api/endpoints'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../context/ToastContext'

const emptyForm = {
  code: '',
  discount_type: 'percent',
  discount_value: '',
  min_order_amount: '',
  max_uses: '',
  max_uses_per_user: '',
  starts_at: '',
  expires_at: '',
  is_active: true,
}

function toDatetimeLocal(iso) {
  if (!iso) return ''
  return iso.slice(0, 16)
}

function PromoForm({ initial, onCancel, onSaved }) {
  const toast = useToast()
  const isEdit = !!initial
  const [form, setForm] = useState(initial ? {
    code: initial.code,
    discount_type: initial.discount_type,
    discount_value: initial.discount_value,
    min_order_amount: initial.min_order_amount ?? '',
    max_uses: initial.max_uses ?? '',
    max_uses_per_user: initial.max_uses_per_user ?? '',
    starts_at: toDatetimeLocal(initial.starts_at),
    expires_at: toDatetimeLocal(initial.expires_at),
    is_active: initial.is_active,
  } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => {
    const value = field === 'is_active' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  const submit = async () => {
    setError(null)
    if (!form.code.trim()) {
      setError('Code is required.')
      return
    }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) {
      setError('Discount value must be greater than zero.')
      return
    }

    const payload = {
      code: form.code.trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_amount: form.min_order_amount === '' ? null : parseFloat(form.min_order_amount),
      max_uses: form.max_uses === '' ? null : parseInt(form.max_uses),
      max_uses_per_user: form.max_uses_per_user === '' ? null : parseInt(form.max_uses_per_user),
      starts_at: form.starts_at || null,
      expires_at: form.expires_at || null,
      is_active: form.is_active,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await adminUpdatePromoCode(initial.id, payload)
        toast('Promo code updated.', 'success')
      } else {
        await adminCreatePromoCode(payload)
        toast('Promo code created.', 'success')
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-bold text-slate-100">{isEdit ? 'Edit Promo Code' : 'New Promo Code'}</h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Code</label>
            <input
              value={form.code}
              onChange={set('code')}
              placeholder="e.g. SAVE10"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 font-mono uppercase focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Discount Type</label>
              <select
                value={form.discount_type}
                onChange={set('discount_type')}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              >
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Value</label>
              <input
                type="number"
                step="0.01"
                value={form.discount_value}
                onChange={set('discount_value')}
                placeholder={form.discount_type === 'percent' ? 'e.g. 10' : 'e.g. 5.00'}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400">Min. Order Amount (optional)</label>
            <input
              type="number"
              step="0.01"
              value={form.min_order_amount}
              onChange={set('min_order_amount')}
              placeholder="No minimum"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Max Total Uses</label>
              <input
                type="number"
                min="1"
                value={form.max_uses}
                onChange={set('max_uses')}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Max Uses / User</label>
              <input
                type="number"
                min="1"
                value={form.max_uses_per_user}
                onChange={set('max_uses_per_user')}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Starts At</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={set('starts_at')}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Expires At</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={set('expires_at')}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={set('is_active')}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500"
            />
            Active
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={saving} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPromoCodes() {
  const toast = useToast()
  const [codes, setCodes] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, {...} = edit
  const [actionLoading, setActionLoading] = useState(null)

  const limit = 20

  const load = (pg = 1) => {
    setLoading(true)
    adminListPromoCodes({ page: pg, limit })
      .then(({ data }) => {
        setCodes(data.items)
        setTotal(data.total)
        setPage(pg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const handleSaved = () => {
    setEditing(null)
    load(page)
  }

  const handleToggleActive = async (promo) => {
    setActionLoading(promo.id)
    try {
      await adminUpdatePromoCode(promo.id, { is_active: !promo.is_active })
      load(page)
    } catch (err) {
      toast(err.response?.data?.error || 'Update failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (promo) => {
    if (!confirm(`Delete promo code "${promo.code}"?`)) return
    setActionLoading(promo.id)
    try {
      await adminDeletePromoCode(promo.id)
      toast('Promo code deleted.', 'success')
      load(page)
    } catch (err) {
      toast(err.response?.data?.error || 'Delete failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const pages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">Promo Codes</h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} total codes</p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition"
        >
          + New Code
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : codes.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No promo codes yet.</p>
      ) : (
        <div className="divide-y divide-slate-800">
          {codes.map((promo) => (
            <div key={promo.id} className="py-4 flex flex-wrap items-center gap-3 justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-200">{promo.code}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    promo.is_active
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-700 bg-slate-900 text-slate-500'
                  }`}>
                    {promo.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {promo.discount_type === 'percent' ? `${promo.discount_value}% off` : `$${promo.discount_value.toFixed(2)} off`}
                  {promo.min_order_amount ? ` · min $${promo.min_order_amount.toFixed(2)}` : ''}
                  {' · used '}{promo.used_count}{promo.max_uses ? ` / ${promo.max_uses}` : ''}
                  {promo.max_uses_per_user ? ` · max ${promo.max_uses_per_user}/user` : ''}
                </p>
                {(promo.starts_at || promo.expires_at) && (
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {promo.starts_at ? `From ${new Date(promo.starts_at).toLocaleString()}` : ''}
                    {promo.starts_at && promo.expires_at ? ' — ' : ''}
                    {promo.expires_at ? `Until ${new Date(promo.expires_at).toLocaleString()}` : ''}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(promo)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:border-slate-600 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(promo)}
                  disabled={actionLoading === promo.id}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition disabled:opacity-50"
                >
                  {promo.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(promo)}
                  disabled={actionLoading === promo.id || promo.used_count > 0}
                  title={promo.used_count > 0 ? 'Already redeemed — deactivate instead' : ''}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              onClick={() => load(pg)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                pg === page ? 'bg-violet-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pg}
            </button>
          ))}
        </div>
      )}

      {editing !== null && (
        <PromoForm
          initial={editing.id ? editing : null}
          onCancel={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </AdminLayout>
  )
}
