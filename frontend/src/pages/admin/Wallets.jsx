import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { adminListWallets, adminAdjustWallet } from '../../api/endpoints'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../context/ToastContext'

function AdjustModal({ wallet, onClose, onSuccess }) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    setError(null)
    const amt = parseFloat(amount)
    if (!amt) {
      setError('Enter a non-zero amount (negative to debit).')
      return
    }
    setLoading(true)
    try {
      await adminAdjustWallet(wallet.user_id, { amount: amt, note })
      toast('Wallet adjusted.', 'success')
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Adjustment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-bold text-slate-100">Adjust Wallet</h2>
        <p className="mt-1 text-xs text-slate-500">{wallet.user_email} — current balance ${parseFloat(wallet.balance).toFixed(2)}</p>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold text-slate-400">Amount (positive = credit, negative = debit)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 10 or -5"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
          />
        </div>
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-slate-400">Note (optional)</label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Reason for adjustment"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
          />
        </div>

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={loading} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50">
            {loading ? 'Please wait…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminWallets() {
  const [wallets, setWallets] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adjusting, setAdjusting] = useState(null)

  const limit = 20

  const load = (pg = 1) => {
    setLoading(true)
    adminListWallets({ page: pg, limit, q: search || undefined })
      .then(({ data }) => {
        setWallets(data.items)
        setTotal(data.total)
        setPage(pg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    load(1)
  }

  const pages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">Manage Wallets</h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} wallets</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-5 flex gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="User email or name…"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
        <button type="submit" className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition">
          Search
        </button>
      </form>

      {loading ? (
        <LoadingSpinner />
      ) : wallets.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No wallets found.</p>
      ) : (
        <div className="divide-y divide-slate-800">
          {wallets.map(w => (
            <div key={w.id} className="flex items-center justify-between py-3">
              <div>
                <span className="text-sm font-semibold text-slate-200">{w.user_name || w.user_email}</span>
                <div className="text-xs text-slate-500">{w.user_email}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-bold text-violet-400">${parseFloat(w.balance).toFixed(2)}</span>
                <button
                  onClick={() => setAdjusting(w)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:border-slate-600 transition"
                >
                  Adjust
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map(pg => (
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

      {adjusting && (
        <AdjustModal
          wallet={adjusting}
          onClose={() => setAdjusting(null)}
          onSuccess={() => { setAdjusting(null); load(page) }}
        />
      )}
    </AdminLayout>
  )
}
