export default function Container({ children, className = '' }) {
  return (
    <main className={`mx-auto max-w-7xl px-4 py-8 ${className}`}>
      {children}
    </main>
  )
}
