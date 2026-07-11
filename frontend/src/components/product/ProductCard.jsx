import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import TypeBadge from './TypeBadge'
import PriceTag from './PriceTag'

export default function ProductCard({ product }) {
  const primary = product.images?.find((i) => i.is_primary) || product.images?.[0]

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-violet-750 transition-all duration-300 h-full"
    >
      {/* Cover Image Container (4:3 Aspect Ratio) */}
      <div className="relative w-full aspect-[4/3] bg-slate-800 overflow-hidden">
        {primary ? (
          <img 
            src={primary.url} 
            alt={product.title} 
            className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-300" 
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-650">
            <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info Content Section */}
      <div className="flex flex-col gap-2 p-4 flex-grow">
        {/* Badges Row - Directly below the image */}
        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge product={product} />
          <TypeBadge type={product.product_type} />
        </div>

        {/* Product Title */}
        <h3 className="font-semibold text-slate-100 line-clamp-2 mt-1">{product.title}</h3>
        
        {/* Pricing tag */}
        <div className="mt-0.5">
          <PriceTag price={product.price} compareAt={product.compare_at_price} currency={product.currency} />
        </div>

        {/* Flex spacer to align stock counts to bottom */}
        <div className="flex-grow"></div>

        {/* Stock counts */}
        {typeof product.available_stock === 'number' && product.status === 'active' && (
          <p className="text-xs text-slate-500 font-medium pt-1">{product.available_stock} in stock</p>
        )}
      </div>
    </Link>
  )
}
