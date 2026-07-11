import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { adminListUsers, adminUpdateUser } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function AdminUsers() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const limit = 20

  const load = (pg = 1) => {
    setLoading(true)
    adminListUsers({ page: pg, limit, role: roleFilter || undefined, q: search || undefined })
      .then(({ data }) => {
        setUsers(data.items)
        setTotal(data.total)
        setPage(pg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [roleFilter])

  const handleSearch = (e) => {
    e.preventDefault()
    load(1)
  }

  const patch = async (userId, updates) => {
    setActionLoading(userId)
    try {
      const { data } = await adminUpdateUser(userId, updates)
      setUsers(prev => prev.map(u => u.id === userId ? data : u))
    } catch (err) {
      alert(err.response?.data?.error || 'Update failed')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleRole = (user) =>
    patch(user.id, { role: user.role === 'admin' ? 'customer' : 'admin' })

  const toggleBan = (user) =>
    patch(user.id, { is_banned: !user.is_banned })

  const pages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">Manage Users</h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} registered users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Email or name…"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
          <button type="submit" className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition">
            Search
          </button>
        </form>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
        >
          <option value="">All roles</option>
          <option value="customer">Customers</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No users found.</p>
      ) : (
        <div className="divide-y divide-slate-800">
          {users.map(user => {
            const isSelf = me?.id === user.id
            const busy = actionLoading === user.id

            return (
              <div key={user.id} className="flex flex-wrap items-center gap-3 justify-between py-4">
                {/* Identity */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200 truncate">{user.full_name}</span>
                    {user.role === 'admin' && (
                      <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                        Admin
                      </span>
                    )}
                    {user.is_banned && (
                      <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                        Banned
                      </span>
                    )}
                    {!user.is_verified && (
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        Unverified
                      </span>
                    )}
                    {isSelf && (
                      <span className="rounded-full bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                    {user.phone && ` · ${user.phone}`}
                  </p>
                </div>

                {/* Actions */}
                {!isSelf && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={busy}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-violet-400 hover:border-violet-500/40 transition disabled:opacity-50"
                    >
                      {user.role === 'admin' ? 'Demote' : 'Make Admin'}
                    </button>
                    <button
                      onClick={() => toggleBan(user)}
                      disabled={busy}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        user.is_banned
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {user.is_banned ? 'Unban' : 'Ban'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map(pg => (
            <button
              key={pg}
              onClick={() => load(pg)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                pg === page
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pg}
            </button>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
