// src/App.jsx — Simplified debug version
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './screens/Home'
import Auth from './screens/Auth'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen relative bg-parchment">
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
// Deployment trigger 2026-05-07 16:40:11
