import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBestSale, getComingSoon, getProducts } from '../api/endpoints'
import ProductGrid from '../components/product/ProductGrid'
import Container from '../components/layout/Container'

function Section({ title, icon, link, children }) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </h2>
        {link && <Link to={link} className="text-sm text-violet-400 hover:text-violet-300">View all →</Link>}
      </div>
      {children}
    </section>
  )
}

export default function Home() {
  const [bestSale, setBestSale] = useState([])
  const [comingSoon, setComingSoon] = useState([])
  const [newest, setNewest] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getBestSale(), getComingSoon(), getProducts()])
      .then(([bs, cs, np]) => {
        setBestSale(bs.data.slice(0, 8))
        setComingSoon(cs.data.slice(0, 8))
        setNewest(np.data.items.slice(0, 8))
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="border-b border-slate-800 bg-gradient-to-b from-violet-950/30 to-transparent py-16 text-center">
        <h1 className="mb-2 text-4xl font-bold text-slate-100 md:text-5xl">Game Accounts & Keys</h1>
        <p className="text-slate-400">Instant delivery from verified inventory.</p>
      </div>
      <Container>
        <Section
          title="Best Sale"
          link="/best-sale"
          icon={
            <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
          }
        >
          <ProductGrid products={bestSale} loading={loading} cols={4} />
        </Section>
        <Section
          title="Coming Soon"
          link="/coming-soon"
          icon={
            <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <ProductGrid products={comingSoon} loading={loading} cols={4} />
        </Section>
        <Section title="New Arrivals">
          <ProductGrid products={newest} loading={loading} cols={4} />
        </Section>
      </Container>
    </>
  )
}
