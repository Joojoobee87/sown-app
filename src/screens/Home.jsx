import TopBar from '../components/TopBar'
import { Link } from 'react-router-dom'

export default function Home() {
  // Replace with real data from Supabase later
  const greeting = getGreeting()
  const taskOfDay = "Deadhead your dahlias to encourage more blooms"
  const plantCount = "20 plants in your library"

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />
      
      <main className="flex-1 p-4 flex flex-col gap-3">
        {/* Greeting */}
        <div>
          <p className="text-xs text-subtle tracking-widest uppercase">{greeting}</p>
          <h2 className="font-serif text-dark text-xl">Your garden today</h2>
        </div>

        {/* Task of the day */}
        <div className="bg-leaf rounded-xl p-4 border-l-2 border-fern">
          <p className="text-xs font-medium text-fern mb-1 tracking-wide">This week</p>
          <p className="text-sm text-muted leading-relaxed">{taskOfDay}</p>
        </div>

        {/* Library summary */}
        <div className="bg-white rounded-xl p-4 border border-moss/40">
          <p className="text-xs text-subtle uppercase tracking-widest mb-2">Your library</p>
          <p className="text-sm text-muted">{plantCount}</p>
        </div>

        {/* Scan CTA */}
        <Link 
          to="/scan" 
          className="bg-fern rounded-xl p-4 text-center text-sage text-sm font-medium tracking-wide active:opacity-80 transition-opacity"
        >
          Tap to scan a plant
        </Link>

        {/* Frost indicator — placeholder */}
        <div className="bg-leaf rounded-xl p-3 flex justify-between items-center">
          <p className="text-sm font-medium text-fern">Frost risk: low</p>
          <span className="text-xs bg-sage text-dark px-3 py-1 rounded-full">Leeds</span>
        </div>
      </main>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
