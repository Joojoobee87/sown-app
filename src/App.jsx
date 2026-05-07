// src/App.jsx — Working authentication with real Supabase integration
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Scan from './screens/Scan'
import Library from './screens/Library'
import Calendar from './screens/Calendar'
import PlantProfile from './screens/PlantProfile'
import NavBar from './components/NavBar'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="max-w-md mx-auto min-h-screen relative bg-parchment">
          <Routes>
            {/* Public auth route */}
            <Route path="/auth" element={<Auth />} />
            
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
            <Route path="/plant/:id" element={
              <ProtectedRoute><PlantProfile /></ProtectedRoute>
            }/>
          </Routes>
          <NavBar />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
