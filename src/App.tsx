import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './screens/Home'
import Scan from './screens/Scan'
import Library from './screens/Library'
import Calendar from './screens/Calendar'
import NavBar from './components/NavBar'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/library" element={<Library />} />
          <Route path="/calendar" element={<Calendar />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  )
}
