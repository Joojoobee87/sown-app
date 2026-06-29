import { useNavigate } from 'react-router-dom'
import SownIcon from '../components/SownIcon'

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  )
}

function FeatureItem({ icon, text }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
      <p className="text-sm text-dark leading-relaxed">{text}</p>
    </div>
  )
}

function Step({ number, title, body }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-fern
                      flex items-center justify-center mt-0.5">
        <span className="text-sage text-xs font-medium">{number}</span>
      </div>
      <div className="flex-1 pb-5 border-b border-moss/20 last:border-0 last:pb-0">
        <p className="text-sm font-medium text-dark mb-0.5">{title}</p>
        <p className="text-sm text-muted leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

export default function About() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-10">

      {/* Header */}
      <div className="bg-fern px-4 pt-4 pb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-sage/80 active:text-sage transition-colors mb-4
                     flex items-center gap-1.5"
        >
          <BackIcon />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex flex-col items-center pt-2 pb-1">
          <SownIcon size={56} fill="#D4DCCA" />
          <h1 className="font-serif text-sage text-3xl tracking-widest mt-3">
            Sown
          </h1>
          <p className="text-moss text-[10px] tracking-[0.25em] uppercase mt-1">
            Garden and Home
          </p>
        </div>
      </div>

      {/* Content card */}
      <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-sm
                      flex flex-col divide-y divide-moss/15">

        {/* Mission */}
        <div className="px-5 py-6">
          <p className="text-sm text-muted leading-relaxed mb-4">
            Sown is a garden companion built for people who love growing things — whether
            you're just starting out or you've been gardening for years.
          </p>
          <p className="text-sm text-muted leading-relaxed mb-4">
            It started with a sketchpad. I bought it specifically to keep track of my plants —
            to stick in the labels, write down the care notes, build a record of everything I was
            growing. I got as far as page one. Life got in the way, and the idea sat waiting.
          </p>
          <p className="text-sm text-muted leading-relaxed mb-4">
            So eventually I stopped waiting and built the app instead.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Sown is designed to be the knowledgeable friend by your side in the garden —
            helping you identify what you've got, remember what you've planted, and know what to
            do and when. No botanical Latin required. Just plain, honest guidance for real gardeners.
          </p>
        </div>

        {/* What Sown does */}
        <div className="px-5 py-6">
          <h2 className="font-serif text-dark text-lg mb-4">What Sown does</h2>
          <div className="flex flex-col gap-3">
            <FeatureItem icon="🌿" text="Scan and identify plants from a photo or tag." />
            <FeatureItem icon="📚" text="Build a personal library of everything growing in your garden." />
            <FeatureItem icon="📅" text="Get seasonal reminders so you never miss a planting window." />
            <FeatureItem icon="🌡️" text="Receive frost alerts before the temperature drops overnight." />
          </div>
        </div>

        {/* How it works */}
        <div className="px-5 py-6">
          <h2 className="font-serif text-dark text-lg mb-5">How it works</h2>
          <div className="flex flex-col gap-4">
            <Step
              number={1}
              title="Point and identify"
              body="Open Scan and point your phone at any plant or garden centre label. Sown reads the photo and tells you what it is — common name, care needs, and what to watch out for."
            />
            <Step
              number={2}
              title="Search before you buy"
              body="Seen something in a magazine or online? Search by name to get full care information and advice on what to look for before you buy."
            />
            <Step
              number={3}
              title="Build your library"
              body="Save plants to your personal garden library, organised by zone — front garden, greenhouse, raised bed, wherever they live. Your wishlist lives here too."
            />
            <Step
              number={4}
              title="Know what to do and when"
              body="Sown keeps track of the seasons so you don't have to. Get timely reminders for pruning, planting, feeding, and protecting from frost."
            />
          </div>
        </div>

        {/* The story */}
        <div className="px-5 py-6">
          <h2 className="font-serif text-dark text-lg mb-3">The story behind it</h2>
          <p className="text-sm text-muted leading-relaxed">
            Sown was created by Jo Frances, a gardener based in Leeds, Yorkshire. It grew from
            a genuine love of the outdoors — and a genuine frustration with tools that let you
            down and knowledge that's hard to find when you need it most.
          </p>
        </div>

        {/* 1% pledge */}
        <div className="px-5 py-6">
          <div className="bg-leaf rounded-xl px-4 py-4 flex gap-4 items-start">
            <span className="text-2xl flex-shrink-0">🌱</span>
            <div>
              <p className="text-sm font-medium text-fern mb-1">Our 1% commitment</p>
              <p className="text-sm text-muted leading-relaxed">
                We commit 1% of every Sown sale to{' '}
                <span className="font-medium text-dark">Perennial</span> — the charity that
                supports people who work in horticulture and their families in difficult times.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* App guide link */}
      <button
        onClick={() => {
          localStorage.removeItem('sown_onboarded')
          navigate('/onboarding')
        }}
        className="mx-4 mt-4 w-[calc(100%-2rem)] bg-leaf border border-moss/40
                   text-fern text-sm font-medium py-3 rounded-xl
                   active:opacity-70 transition-opacity"
      >
        View app guide
      </button>

      {/* Version footer */}
      <p className="text-center text-xs text-subtle/50 mt-6 tracking-wide">
        Sown Garden and Home · Version 1.0
      </p>

    </div>
  )
}
