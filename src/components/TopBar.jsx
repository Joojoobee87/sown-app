export default function TopBar({ right }) {
  return (
    <header className="bg-fern px-4 py-3 flex items-center justify-between">
      {/* Seed S mark */}
      <svg width="24" height="30" viewBox="0 0 24 30">
        <ellipse cx="12" cy="8" rx="7" ry="8" fill="#D4DCCA"/>
        <line x1="7" y1="4" x2="12" y2="11" stroke="#4A5940" strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>
        <ellipse cx="12" cy="22" rx="7" ry="8" fill="#D4DCCA" transform="rotate(180 12 22)"/>
        <line x1="9" y1="17" x2="14" y2="24" stroke="#4A5940" strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>
      </svg>
      
      {/* Wordmark */}
      <h1 className="font-serif text-sage text-2xl tracking-widest">Sown</h1>
      
      {/* Optional right element — e.g. a settings icon */}
      <div className="w-6">{right || null}</div>
    </header>
  )
}
