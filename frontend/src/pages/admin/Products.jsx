import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminListProducts, adminDeleteProduct } from '../../api/endpoints'
import AdminLayout from './AdminLayout'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/product/StatusBadge'

export default function AdminProducts() {
  const [data, setData] = useState({ items: [], total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = (p = 1) => {
    setLoading(true)
    adminListProducts({ page: p, limit: 20 })
      .then(({ data: d }) => { setData(d); setPage(p) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return
    await adminDeleteProduct(id)
    load(page)
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Products <span className="text-slate-500 text-lg">({data.total})</span></h1>
        <Link to="/admin/products/new">
          <Button className="sheen-btn">+ New product</Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/20">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 w-full rounded bg-slate-800" /></td>
                ))}
              </tr>
            ))}
            {!loading && data.items.map((p) => (
              <tr key={p.id} className="text-slate-300 hover:bg-slate-900/50">
                <td className="px-4 py-3 font-medium text-slate-100 max-w-xs truncate">{p.title}</td>
                <td className="px-4 py-3 text-slate-500 capitalize">{p.product_type.replace('_', ' ')}</td>
                <td className="px-4 py-3 font-mono">${parseFloat(p.price).toFixed(2)}</td>
                <td className="px-4 py-3"><StatusBadge product={p} /></td>
                <td className="px-4 py-3 font-mono">{p.available_stock ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs">
                    <Link to={`/admin/products/${p.id}/stock`} className="text-emerald-450 hover:underline">Stock</Link>
                    <Link to={`/admin/products/${p.id}/edit`} className="text-slate-400 hover:text-slate-200">Edit</Link>
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-400">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
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
