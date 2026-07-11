import { useEffect, useState } from 'react'
import client from '../../api/client'
import AdminLayout from './AdminLayout'
import Button from '../../components/ui/Button'

export default function AdminMessages() {
  const [data, setData] = useState({ items: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = (p = 1) => {
    setLoading(true)
    client.get(`/admin/messages?page=${p}&limit=20`)
      .then(({ data: d }) => { setData(d); setPage(p) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleExpand = async (msg) => {
    if (expanded === msg.id) { setExpanded(null); return }
    setExpanded(msg.id)
    if (!msg.is_read) {
      await client.patch(`/admin/messages/${msg.id}/read`).catch(() => {})
      setData(prev => ({
        ...prev,
        items: prev.items.map(m => m.id === msg.id ? { ...m, is_read: true } : m)
      }))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this message?')) return
    await client.delete(`/admin/messages/${id}`)
    load(page)
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">
          Contact Messages <span className="text-slate-500 text-lg">({data.total})</span>
        </h1>
      </div>

      {loading ? (
        <div className="flex py-16 justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : data.items.length === 0 ? (
        <p className="py-16 text-center text-slate-500">No messages yet.</p>
      ) : (
        <div className="space-y-3">
          {data.items.map((msg) => (
            <div key={msg.id} className={`rounded-2xl border p-5 transition ${msg.is_read ? 'border-slate-800 bg-slate-900/40' : 'border-violet-500/30 bg-violet-500/5'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    {!msg.is_read && <span className="h-2 w-2 rounded-full bg-violet-500 flex-shrink-0" />}
                    <span className="font-semibold text-slate-100">{msg.name}</span>
                    <a href={`mailto:${msg.email}`} className="text-sm text-violet-400 hover:underline">{msg.email}</a>
                    {msg.phone && (
                      <a href={`tel:${msg.phone}`} className="text-sm text-emerald-400 hover:underline">{msg.phone}</a>
                    )}
                    <span className="text-xs text-slate-600">{new Date(msg.created_at + 'Z').toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-300">{msg.subject}</p>
                  {expanded === msg.id && (
                    <p className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
                      {msg.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleExpand(msg)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition">
                    {expanded === msg.id ? 'Hide' : 'View'}
                  </button>
                  <button onClick={() => handleDelete(msg.id)}
                    className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.total > 20 && (
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="ghost" disabled={page === 1} onClick={() => load(page - 1)}>← Prev</Button>
          <span className="self-center text-sm text-slate-500">Page {page}</span>
          <Button variant="ghost" disabled={page * 20 >= data.total} onClick={() => load(page + 1)}>Next →</Button>
        </div>
      )}
    </AdminLayout>
  )
}
