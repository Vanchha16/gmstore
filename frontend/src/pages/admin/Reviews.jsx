import { useEffect, useState } from 'react'
import client from '../../api/client'
import AdminLayout from './AdminLayout'
import Button from '../../components/ui/Button'

const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

export default function AdminReviews() {
  const [data, setData] = useState({ items: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = (p = 1) => {
    setLoading(true)
    client.get(`/admin/reviews?page=${p}&limit=20`)
      .then(({ data: d }) => { setData(d); setPage(p) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this review?')) return
    await client.delete(`/admin/reviews/${id}`)
    load(page)
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">
          Reviews <span className="text-slate-500 text-lg">({data.total})</span>
        </h1>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Comment</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-slate-800" /></td>
                ))}
              </tr>
            ))}
            {!loading && data.items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-900/50">
                <td className="px-4 py-3 text-slate-300 font-medium max-w-[160px] truncate">
                  {r.product_title || `#${r.product_id}`}
                </td>
                <td className="px-4 py-3 text-amber-400 font-mono text-xs">{STARS(r.rating)}</td>
                <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{r.comment || '—'}</td>
                <td className="px-4 py-3">
                  {r.is_verified_purchase
                    ? <span className="text-xs text-emerald-400">✓ Verified</span>
                    : <span className="text-xs text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(r.created_at + 'Z').toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(r.id)}
                    className="text-xs text-red-500 hover:text-red-400">Delete</button>
                </td>
              </tr>
            ))}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No reviews yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data.total > 20 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="ghost" disabled={page === 1} onClick={() => load(page - 1)}>← Prev</Button>
          <span className="self-center text-sm text-slate-500">Page {page}</span>
          <Button variant="ghost" disabled={page * 20 >= data.total} onClick={() => load(page + 1)}>Next →</Button>
        </div>
      )}
    </AdminLayout>
  )
}
