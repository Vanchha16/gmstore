import ProductCard from './ProductCard'

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-slate-800" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-1/3 rounded bg-slate-800" />
        <div className="h-4 w-3/4 rounded bg-slate-800" />
        <div className="h-5 w-1/4 rounded bg-slate-800" />
      </div>
    </div>
  )
}

export default function ProductGrid({ products, loading, cols = 4 }) {
  const gridClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  }[cols] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'

  if (loading) {
    return (
      <div className={`grid gap-4 ${gridClass}`}>
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (!products?.length) {
    return <p className="py-16 text-center text-slate-500">No products found.</p>
  }

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
