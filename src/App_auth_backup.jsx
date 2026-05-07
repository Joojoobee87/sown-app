// src/App.jsx — updated with authentication
// Replace your existing App.jsx with this

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider }  from './context/AuthContext'
import ProtectedRoute    from './components/ProtectedRoute'
import Auth              from './screens/Auth'
import Home              from './screens/Home'
import Scan              from './screens/Scan'
import Library           from './screens/Library'
import Calendar          from './screens/Calendar'
import PlantProfile      from './screens/PlantProfile'
import NavBar            from './components/NavBar'

export default function App() {
  return (
    // AuthProvider wraps everything — makes useAuth() available everywhere
    <AuthProvider>
      <BrowserRouter>
        <div className="max-w-md mx-auto min-h-screen relative bg-parchment">
          <Routes>

            {/* Public routes — no auth required */}
            <Route path="/auth" element={<Auth />} />

            {/* Protected routes — redirect to /auth if not signed in */}
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
            <Route path="/plant/:id" element={
              <ProtectedRoute><PlantProfile /></ProtectedRoute>
            }/>

          </Routes>

          {/* NavBar only shows when authenticated */}
          <NavBar />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
