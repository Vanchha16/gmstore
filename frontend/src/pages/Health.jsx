import { useEffect, useState } from 'react'
import client from '../api/client'

export default function Health() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/health')
      .then(({ data }) => setStatus(data))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="mb-4 text-2xl font-semibold text-violet-400">GM Store</h1>
        {status && (
          <div className="space-y-1 text-sm">
            <p>
              API:{' '}
              <span className="font-mono text-emerald-400">{status.status}</span>
            </p>
            <p>
              DB:{' '}
              <span className={`font-mono ${status.db === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
                {status.db}
              </span>
            </p>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400">
            Cannot reach API: {error}
          </p>
        )}
        {!status && !error && (
          <p className="text-sm text-slate-500">Pinging backend…</p>
        )}
      </div>
    </div>
  )
}
