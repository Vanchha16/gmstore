import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { adminListStock, adminAddStock, adminDeleteStock, adminGetProduct, adminUpdateStock, adminGetAwaitingCount } from '../../api/endpoints'
import AdminLayout from './AdminLayout'
import Button from '../../components/ui/Button'

export default function AdminStock() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [data, setData] = useState({ items: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [genCount, setGenCount] = useState('10')
  const [genPrefix, setGenPrefix] = useState('')
  const [awaitingCount, setAwaitingCount] = useState(0)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [editError, setEditError] = useState('')

  const load = (p = 1) => {
    setLoading(true)
    adminListStock(id, { page: p, limit: 50 })
      .then(({ data: d }) => { setData(d); setPage(p) })
      .finally(() => setLoading(false))
  }

  const loadAwaitingCount = () => {
    adminGetAwaitingCount(id).then(({ data }) => setAwaitingCount(data.count)).catch(() => {})
  }

  useEffect(() => {
    adminGetProduct(id).then(({ data: p }) => setProduct(p))
    load()
    loadAwaitingCount()
  }, [id])

  const handleGenerate = () => {
    const count = Math.min(Math.max(1, parseInt(genCount) || 1), 500)
    const prefix = genPrefix.trim()
    const pad = String(count).length
    const lines = Array.from({ length: count }, (_, i) => {
      const num = String(i + 1).padStart(pad, '0')
      if (product?.product_type === 'account') {
        return prefix ? `${prefix}_user${num}:pass${num}` : `user${num}:password${num}`
      }
      return prefix ? `${prefix}-${num}` : `KEY-${num}`
    })
    setText(lines.join('\n'))
    setMsg('')
    setErrorMsg('')
  }

  const handleAdd = async () => {
    setMsg('')
    setErrorMsg('')
    const payloads = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!payloads.length) return

    // Validation check
    if (product?.product_type === 'account') {
      const invalid = payloads.find((l) => !l.includes(':'))
      if (invalid) {
        setErrorMsg(`Format error: "${invalid}" is invalid. Account credentials must be in 'username:password' format.`)
        return
      }
    } else if (product?.product_type === 'game_key') {
      const invalid = payloads.find((l) => l.includes(':'))
      if (invalid) {
        setErrorMsg(`Format error: "${invalid}" is invalid. Game keys must not contain colons (':').`)
        return
      }
    }

    setAdding(true)
    try {
      const { data: res } = await adminAddStock(id, payloads)
      setMsg(res.message)
      setText('')
      load(1)
      loadAwaitingCount()
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to add stock.')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (itemId) => {
    if (!confirm('Delete this stock item?')) return
    await adminDeleteStock(itemId)
    load(page)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditVal(item.secret_payload || '')
    setEditError('')
  }

  const handleSaveEdit = async (itemId) => {
    setEditError('')
    const trimmed = editVal.trim()
    if (!trimmed) {
      setEditError('Credential payload cannot be empty.')
      return
    }

    // Validation check
    if (product?.product_type === 'account') {
      if (!trimmed.includes(':')) {
        setEditError("Must be in 'username:password' format.")
        return
      }
    } else if (product?.product_type === 'game_key') {
      if (trimmed.includes(':')) {
        setEditError('Game keys must not contain colons (":"\).')
        return
      }
    }

    try {
      await adminUpdateStock(itemId, { secret_payload: trimmed })
      setEditingId(null)
      load(page)
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update item.')
    }
  }

  const statusColor = { available: 'text-emerald-400', sold: 'text-slate-500' }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/admin/products" className="text-slate-400 hover:text-slate-200">← Catalog</Link>
        <h1 className="text-xl font-bold text-slate-100">
          Stock — <span className="text-emerald-400">{product?.title}</span>
        </h1>
        <span className="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400 capitalize">
          Type: {product?.product_type?.replace('_', ' ')}
        </span>
        {awaitingCount > 0 && (
          <span className="rounded-full bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 text-xs font-semibold text-orange-400">
            ⏳ {awaitingCount} order{awaitingCount > 1 ? 's' : ''} pending delivery for this product
          </span>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Add stock */}
        <div>
          <h2 className="mb-3 font-semibold text-slate-200">Bulk add credentials</h2>

          {/* Quick Generate */}
          <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-400">Quick Generate</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="500"
                value={genCount}
                onChange={e => setGenCount(e.target.value)}
                className="w-20 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-violet-500"
                placeholder="Qty"
              />
              <input
                value={genPrefix}
                onChange={e => setGenPrefix(e.target.value)}
                placeholder={product?.product_type === 'account' ? 'Prefix (optional)' : 'Key prefix (optional)'}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
              />
              <button
                onClick={handleGenerate}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition"
              >
                Generate
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              Fills the textarea below with placeholder credentials — edit them before submitting.
            </p>
          </div>

          <p className="mb-2 text-xs text-slate-500">
            One credential per line. Each line becomes one stock item.<br />
            {product?.product_type === 'account' ? (
              <span className="text-violet-400 font-semibold">⚠️ Account format: username:password</span>
            ) : (
              <span className="text-emerald-400 font-semibold">⚠️ Game key format: a single key code (no colons)</span>
            )}
          </p>
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={product?.product_type === 'account' ? "username1:password1\nusername2:password2" : "GAME-KEY-XXXX-YYYY-ZZZZ"}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-sm text-slate-100 outline-none focus:border-violet-500 resize-none"
          />
          {msg && <p className="mt-2 text-sm text-emerald-450 font-medium">{msg}</p>}
          {errorMsg && <p className="mt-2 text-sm text-red-400 font-medium">{errorMsg}</p>}
          
          <Button onClick={handleAdd} loading={adding} className="mt-3">Add to inventory</Button>
        </div>

        {/* Stock list */}
        <div>
          <h2 className="mb-3 font-semibold text-slate-200">Inventory <span className="text-slate-500">({data.total})</span></h2>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {loading && data.items.length === 0 && <p className="text-sm text-slate-500 animate-pulse">Loading…</p>}
            {!loading && data.items.length === 0 && <p className="text-sm text-slate-500">No stock items uploaded yet.</p>}
            
            {data.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-xs font-semibold ${statusColor[item.status]}`}>{item.status}</span>
                    <span className="text-[10px] text-slate-600 ml-2">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  
                  {item.status === 'available' && editingId !== item.id && (
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(item)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium">Edit</button>
                      <button onClick={() => handleDelete(item.id)} className="text-xs text-red-500 hover:text-red-400 transition-colors font-medium">Delete</button>
                    </div>
                  )}
                </div>

                {editingId === item.id ? (
                  <div className="mt-1 flex flex-col gap-1.5 w-full">
                    <input
                      type="text"
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      className="w-full font-mono text-sm rounded border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-slate-100 outline-none focus:border-violet-500 transition"
                    />
                    {editError && <p className="text-xs text-red-400 mt-0.5">{editError}</p>}
                    <div className="flex gap-3 mt-1">
                      <button onClick={() => handleSaveEdit(item.id)} className="text-xs text-emerald-450 hover:underline font-semibold">Save Changes</button>
                      <button onClick={() => { setEditingId(null); setEditError(''); }} className="text-xs text-slate-500 hover:underline font-semibold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 font-mono text-xs text-slate-400 flex items-center gap-2 bg-slate-800/20 px-2.5 py-1.5 rounded border border-slate-800/50">
                    <span className="font-semibold text-slate-500 select-none">Credentials:</span>
                    <span className="text-slate-200 select-all">{item.secret_payload || '—'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {data.total > 50 && (
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" disabled={page === 1} onClick={() => load(page - 1)}>← Prev</Button>
              <Button variant="ghost" disabled={page * 50 >= data.total} onClick={() => load(page + 1)}>Next →</Button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
