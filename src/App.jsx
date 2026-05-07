// src/App.jsx — Working authentication with real Auth component
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
      <div className="max-w-md mx-auto min-h-screen relative bg-parchment">
        <Routes>
          {/* Auth route */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Default route - show auth screen */}
          <Route path="/" element={<Auth />} />
          
          {/* Protected routes - show auth screen for now */}
          <Route path="/scan" element={<Auth />} />
          <Route path="/library" element={<Auth />} />
          <Route path="/calendar" element={<Auth />} />
          <Route path="/plant/:id" element={<Auth />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
