export default function PriceTag({ price, compareAt, currency = 'USD' }) {
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-lg font-semibold text-slate-100">{fmt(price)}</span>
      {compareAt && compareAt > price && (
        <span className="text-sm text-slate-500 line-through">{fmt(compareAt)}</span>
      )}
    </span>
  )
}
