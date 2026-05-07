// src/App.jsx — Simple authentication that shows auth screen
import { BrowserRouter, Routes, Route } from 'react-router-dom'

export default function App() {
  console.log('App: Rendering')
  
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen relative bg-parchment">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-moss">Sown App</h1>
          <p className="text-subtle">Authentication screen should appear below</p>
        </div>
        <Routes>
          {/* Default route - show auth screen */}
          <Route path="/" element={
            <>
              {console.log('Rendering Auth component for /')}
              <div className="p-4 bg-white rounded-lg m-4">
                <h2 className="text-lg font-semibold text-moss">Auth Screen</h2>
                <p className="text-subtle">This is a test to verify routing works</p>
              </div>
            </>
          } />
          <Route path="/auth" element={
            <>
              {console.log('Rendering Auth component for /auth')}
              <div className="p-4 bg-white rounded-lg m-4">
                <h2 className="text-lg font-semibold text-moss">Auth Screen</h2>
                <p className="text-subtle">This is a test to verify routing works</p>
              </div>
            </>
          } />
          
          {/* Protected routes - show auth screen for now */}
          <Route path="/scan" element={
            <>
              {console.log('Rendering Auth component for /scan')}
              <div className="p-4 bg-white rounded-lg m-4">
                <h2 className="text-lg font-semibold text-moss">Auth Screen</h2>
                <p className="text-subtle">This is a test to verify routing works</p>
              </div>
            </>
          } />
          <Route path="/library" element={
            <>
              {console.log('Rendering Auth component for /library')}
              <div className="p-4 bg-white rounded-lg m-4">
                <h2 className="text-lg font-semibold text-moss">Auth Screen</h2>
                <p className="text-subtle">This is a test to verify routing works</p>
              </div>
            </>
          } />
          <Route path="/calendar" element={
            <>
              {console.log('Rendering Auth component for /calendar')}
              <div className="p-4 bg-white rounded-lg m-4">
                <h2 className="text-lg font-semibold text-moss">Auth Screen</h2>
                <p className="text-subtle">This is a test to verify routing works</p>
              </div>
            </>
          } />
          <Route path="/plant/:id" element={
            <>
              {console.log('Rendering Auth component for /plant/:id')}
              <div className="p-4 bg-white rounded-lg m-4">
                <h2 className="text-lg font-semibold text-moss">Auth Screen</h2>
                <p className="text-subtle">This is a test to verify routing works</p>
              </div>
            </>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
