// src/components/AdminRoute.jsx
// Admin-only screens. The database enforces admin access on its own (Row
// Level Security and is_catalogue_admin()); this just keeps other users
// away from screens that would show them nothing.

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from './ProtectedRoute'

export const isAdmin = (user) => user?.app_metadata?.role === 'admin'

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  return (
    <ProtectedRoute>
      {!loading && !isAdmin(user) ? <Navigate to="/" replace /> : children}
    </ProtectedRoute>
  )
}
