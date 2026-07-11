import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getProducts, getCategories } from '../api/endpoints'
import ProductGrid from '../components/product/ProductGrid'
import Container from '../components/layout/Container'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'best_sale', label: 'Best Selling' },
]

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const type = searchParams.get('type') || ''
  const sort = searchParams.get('sort') || 'newest'
  const minPrice = searchParams.get('min') || ''
  const maxPrice = searchParams.get('max') || ''

  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    getCategories().then(({ data }) => setCategories(data)).catch(() => {})
  }, [])

  useEffect(() => {
    setPage(1)
  }, [q, category, type, sort, minPrice, maxPrice])

  useEffect(() => {
    setLoading(true)
    getProducts({ q, category, type, sort, min: minPrice, max: maxPrice, page, limit: 20 })
      .then(({ data }) => { setProducts(data.items); setTotal(data.total) })
      .finally(() => setLoading(false))
  }, [q, category, type, sort, minPrice, maxPrice, page])

  const set = (key, val) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set(key, val); else next.delete(key)
    setSearchParams(next)
  }

  return (
    <Container>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">
          {q ? `Results for "${q}"` : 'All Products'}
          <span className="ml-2 text-base font-normal text-slate-500">({total})</span>
        </h1>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters sidebar */}
        <aside className="w-full lg:w-56 flex-shrink-0 space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Category</p>
            <div className="space-y-1">
              <button onClick={() => set('category', '')}
                className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${!category ? 'bg-violet-600/20 text-violet-400' : 'text-slate-400 hover:text-slate-200'}`}>
                All
              </button>
              {categories.map((c) => (
                <button key={c.id} onClick={() => set('category', c.slug)}
                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${category === c.slug ? 'bg-violet-600/20 text-violet-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</p>
            {[['', 'All'], ['account', 'Game Account'], ['game_key', 'Game Key']].map(([val, label]) => (
              <button key={val} onClick={() => set('type', val)}
                className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${type === val ? 'bg-violet-600/20 text-violet-400' : 'text-slate-400 hover:text-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Price (USD)</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" placeholder="Min" value={minPrice}
                onChange={(e) => set('min', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500" />
              <span className="text-slate-600">–</span>
              <input type="number" min="0" placeholder="Max" value={maxPrice}
                onChange={(e) => set('max', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500" />
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">{total} product{total !== 1 ? 's' : ''}</p>
            <select value={sort} onChange={(e) => set('sort', e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-violet-500">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <ProductGrid products={products} loading={loading} cols={3} />

          {total > 20 && (
            <div className="mt-8 flex justify-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30">← Prev</button>
              <span className="self-center text-sm text-slate-500">Page {page} of {Math.ceil(total / 20)}</span>
              <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30">Next →</button>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
