import TopBar from '../components/TopBar'

export default function Calendar() {
  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />
      
      <main className="flex-1 p-4">
        <div className="text-center py-8">
          <h2 className="font-serif text-dark text-xl mb-4">Garden Calendar</h2>
          <p className="text-muted">Coming soon...</p>
        </div>
      </main>
    </div>
  )
}
