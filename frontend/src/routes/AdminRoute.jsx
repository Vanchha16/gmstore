import ProtectedRoute from './ProtectedRoute'

export default function AdminRoute({ children }) {
  return <ProtectedRoute adminOnly>{children}</ProtectedRoute>
}
