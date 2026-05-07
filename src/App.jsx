// src/App.jsx — Working version with authentication
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
  console.log('App: Rendering with authentication')
  
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="max-w-md mx-auto min-h-screen relative bg-parchment">
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={
              <>
                {console.log('App: Rendering Auth route')}
                <Auth />
              </>
            } />
            
            {/* Protected routes with fallback logic */}
            <Route path="/" element={
              <>
                {console.log('App: Rendering protected Home route')}
                <ProtectedRoute><Home /></ProtectedRoute>
              </>
            }/>
            <Route path="/scan" element={
              <>
                {console.log('App: Rendering protected Scan route')}
                <ProtectedRoute><Scan /></ProtectedRoute>
              </>
            }/>
            <Route path="/library" element={
              <>
                {console.log('App: Rendering protected Library route')}
                <ProtectedRoute><Library /></ProtectedRoute>
              </>
            }/>
            <Route path="/calendar" element={
              <>
                {console.log('App: Rendering protected Calendar route')}
                <ProtectedRoute><Calendar /></ProtectedRoute>
              </>
            }/>
            <Route path="/plant/:id" element={
              <>
                {console.log('App: Rendering protected PlantProfile route')}
                <ProtectedRoute><PlantProfile /></ProtectedRoute>
              </>
            }/>
          </Routes>
          <NavBar />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
