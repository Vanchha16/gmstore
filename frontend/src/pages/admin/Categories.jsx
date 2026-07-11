import { useEffect, useState } from 'react'
import client from '../../api/client'
import { adminListCategories, adminCreateCategory } from '../../api/endpoints'
import AdminLayout from './AdminLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const load = () => {
    setLoading(true)
    adminListCategories()
      .then(({ data }) => setCategories(data))
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    setError('')
    setSuccess('')
    try {
      const { data } = await adminCreateCategory({ name: name.trim() })
      setSuccess(`Category "${data.name}" created.`)
      setName('')
      load()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (cat) => {
    setEditing(cat.id)
    setEditName(cat.name)
  }

  const saveEdit = async (id) => {
    setActionLoading(id)
    try {
      const { data } = await client.patch(`/admin/products/categories/${id}`, { name: editName.trim() })
      setCategories(prev => prev.map(c => c.id === id ? data : c))
      setEditing(null)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const deleteCategory = async (cat) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return
    setActionLoading(cat.id)
    try {
      await client.delete(`/admin/products/categories/${cat.id}`)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
      setSuccess(`Category "${cat.name}" deleted.`)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Manage Categories</h1>
        <p className="text-xs text-slate-500">Classification tags for game accounts and keys.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Create */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-5 h-fit">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Create Category</h2>

          {success && (
            <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-400">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Category Name *"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Action, Steam Keys"
            />
            <Button type="submit" loading={adding} className="w-full">
              Add Category
            </Button>
          </form>
        </div>

        {/* List */}
        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-950/20 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">
            Existing Categories <span className="text-slate-500 font-normal">({categories.length})</span>
          </h2>

          {loading && categories.length === 0 ? (
            <LoadingSpinner />
          ) : categories.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">No categories yet.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {categories.map((cat) => {
                const busy = actionLoading === cat.id
                return (
                  <div key={cat.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    {editing === cat.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') setEditing(null) }}
                        className="flex-1 rounded-lg border border-violet-500/50 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 outline-none"
                      />
                    ) : (
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-slate-200">{cat.name}</span>
                        <p className="text-[10px] text-slate-600 mt-0.5">{cat.slug}</p>
                      </div>
                    )}

                    <div className="flex gap-2 flex-shrink-0">
                      {editing === cat.id ? (
                        <>
                          <button onClick={() => saveEdit(cat.id)} disabled={busy}
                            className="rounded-lg border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-50">
                            Save
                          </button>
                          <button onClick={() => setEditing(null)}
                            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(cat)} disabled={busy}
                            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition disabled:opacity-50">
                            Rename
                          </button>
                          <button onClick={() => deleteCategory(cat)} disabled={busy}
                            className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 transition disabled:opacity-50">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
