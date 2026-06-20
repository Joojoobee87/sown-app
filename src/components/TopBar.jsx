import SownIcon from './SownIcon'

export default function TopBar({ right }) {
  return (
    <header className="bg-fern px-4 py-3 flex items-center justify-between">
      <SownIcon size={32} fill="#D4DCCA" />

      <h1 className="font-serif text-sage text-2xl tracking-widest">Sown</h1>

      <div className="w-8">{right || null}</div>
    </header>
  )
}
