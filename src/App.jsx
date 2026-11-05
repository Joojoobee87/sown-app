// src/App.jsx — Working authentication with real Supabase integration
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import AdminQueue from './screens/admin/AdminQueue'
import AdminPlant from './screens/admin/AdminPlant'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Scan from './screens/Scan'
import Library from './screens/Library'
import Calendar from './screens/Calendar'
import NavBar from './components/NavBar'
import PasswordReset from './screens/PasswordReset'
import About from './screens/About'
import Profile from './screens/Profile'
import GardenZones from './screens/GardenZones'
import Onboarding from './screens/Onboarding'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// A password recovery link can open on any page (links sent from the
// Supabase dashboard go to the Site URL, "/"). Wherever it lands, send the
// user to set a new password instead of letting them straight in.
function RecoveryRedirect() {
  const { recoveryMode } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (recoveryMode && pathname !== '/password-reset') {
      navigate('/password-reset', { replace: true })
    }
  }, [recoveryMode, pathname, navigate])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <RecoveryRedirect />
        <div className="max-w-md mx-auto min-h-screen relative bg-parchment">
          <Routes>
            {/* Public auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/password-reset" element={<PasswordReset />} />

            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute><Home /></ProtectedRoute>
            }/>
            <Route path="/scan" element={
              <ProtectedRoute><Scan /></ProtectedRoute>
            }/>
            <Route path="/library" element={
              <ProtectedRoute><Library /></ProtectedRoute>
            }/>
            <Route path="/calendar" element={
              <ProtectedRoute><Calendar /></ProtectedRoute>
            }/>
            <Route path="/about" element={
              <ProtectedRoute><About /></ProtectedRoute>
            }/>
            <Route path="/profile" element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            }/>
            <Route path="/zones" element={
              <ProtectedRoute><GardenZones /></ProtectedRoute>
            }/>
            <Route path="/admin" element={
              <AdminRoute><AdminQueue /></AdminRoute>
            }/>
            <Route path="/admin/plant/:id" element={
              <AdminRoute><AdminPlant /></AdminRoute>
            }/>
            <Route path="/onboarding" element={
              <ProtectedRoute><Onboarding /></ProtectedRoute>
            }/>
          </Routes>
          <NavBar />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
