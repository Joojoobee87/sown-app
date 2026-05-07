import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './screens/Home'
import Scan from './screens/Scan'
import Library from './screens/Library'
import Calendar from './screens/Calendar'
import PlantProfile from './screens/PlantProfile'
import NavBar from './components/NavBar'
import type { Plant } from './screens/PlantProfile'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen relative bg-parchment">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/library" element={<Library />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/plant/:id" element={<PlantProfile />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  )
}
