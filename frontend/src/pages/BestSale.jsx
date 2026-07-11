import { useEffect, useState } from 'react'
import { getBestSale } from '../api/endpoints'
import ProductGrid from '../components/product/ProductGrid'
import Container from '../components/layout/Container'

export default function BestSale() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBestSale().then(({ data }) => setProducts(data)).finally(() => setLoading(false))
  }, [])

  return (
    <Container>
      <h1 className="mb-6 text-2xl font-bold text-slate-100">Best Sale</h1>
      <ProductGrid products={products} loading={loading} />
    </Container>
  )
}
