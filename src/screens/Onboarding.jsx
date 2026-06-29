import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SownIcon from '../components/SownIcon'

// ─── Slide illustrations ───────────────────────────────────────────────────────
function IllustrationZones() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="52" fill="#EEF0E8" />
      <rect x="28" y="38" width="26" height="26" rx="4" fill="#BFCAAD" />
      <rect x="28" y="68" width="26" height="18" rx="4" fill="#4A5940" opacity="0.5" />
      <rect x="58" y="38" width="34" height="56" rx="4" fill="#4A5940" opacity="0.3" />
      <line x1="28" y1="64" x2="92" y2="64" stroke="#8A7E6E" strokeWidth="1" strokeDasharray="3 2"/>
      <line x1="56" y1="38" x2="56" y2="94" stroke="#8A7E6E" strokeWidth="1" strokeDasharray="3 2"/>
      <circle cx="41" cy="51" r="5" fill="#4A5940" opacity="0.7"/>
      <circle cx="75" cy="65" r="7" fill="#4A5940" opacity="0.5"/>
      <circle cx="41" cy="79" r="4" fill="#C8B99A" opacity="0.8"/>
    </svg>
  )
}

function IllustrationScan() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="52" fill="#EEF0E8" />
      {/* Camera body */}
      <rect x="30" y="42" width="60" height="44" rx="6" fill="#4A5940" opacity="0.2" stroke="#4A5940" strokeWidth="1.5"/>
      {/* Lens */}
      <circle cx="60" cy="64" r="15" fill="white" stroke="#4A5940" strokeWidth="1.5"/>
      <circle cx="60" cy="64" r="10" fill="#BFCAAD"/>
      <circle cx="60" cy="64" r="5" fill="#4A5940" opacity="0.6"/>
      {/* Corner brackets */}
      <path d="M38 50v-4h4" stroke="#4A5940" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M78 50v-4h4" stroke="#4A5940" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M38 78v4h4" stroke="#4A5940" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M78 78v4h4" stroke="#4A5940" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Leaf hint */}
      <path d="M57 61c0 0-3-2.5-3-5 0-1.7 1.3-2.5 3-2.5s3 .8 3 2.5c0 2.5-3 5-3 5z"
        stroke="#D4DCCA" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function IllustrationCalendar() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="52" fill="#EEF0E8" />
      <rect x="28" y="38" width="64" height="52" rx="6" fill="white" stroke="#BFCAAD" strokeWidth="1.5"/>
      <rect x="28" y="38" width="64" height="16" rx="6" fill="#4A5940" opacity="0.8"/>
      <rect x="28" y="48" width="64" height="6" fill="#4A5940" opacity="0.8"/>
      {/* Grid dots */}
      <circle cx="42" cy="66" r="2.5" fill="#BFCAAD"/>
      <circle cx="55" cy="66" r="2.5" fill="#BFCAAD"/>
      <circle cx="68" cy="66" r="2.5" fill="#4A5940" opacity="0.6"/>
      <circle cx="81" cy="66" r="2.5" fill="#BFCAAD"/>
      <circle cx="42" cy="78" r="2.5" fill="#BFCAAD"/>
      <circle cx="55" cy="78" r="2.5" fill="#C8B99A"/>
      <circle cx="68" cy="78" r="2.5" fill="#BFCAAD"/>
      {/* Tick */}
      <circle cx="68" cy="66" r="8" fill="#4A5940" opacity="0.15"/>
      <path d="M64 66l3 3 5-5" stroke="#4A5940" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Calendar pins */}
      <rect x="42" y="34" width="4" height="8" rx="2" fill="#8A7E6E"/>
      <rect x="74" y="34" width="4" height="8" rx="2" fill="#8A7E6E"/>
    </svg>
  )
}

function IllustrationWeather() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="52" fill="#EEF0E8" />
      {/* Cloud */}
      <ellipse cx="60" cy="55" rx="22" ry="14" fill="white" stroke="#BFCAAD" strokeWidth="1.5"/>
      <circle cx="45" cy="58" r="10" fill="white" stroke="#BFCAAD" strokeWidth="1.5"/>
      <circle cx="75" cy="58" r="8" fill="white" stroke="#BFCAAD" strokeWidth="1.5"/>
      {/* Raindrops */}
      <line x1="48" y1="72" x2="45" y2="82" stroke="#4A5940" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <line x1="60" y1="74" x2="57" y2="84" stroke="#4A5940" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <line x1="72" y1="72" x2="69" y2="82" stroke="#4A5940" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      {/* Sun peek */}
      <circle cx="84" cy="42" r="8" fill="#C8B99A" opacity="0.7"/>
      <line x1="84" y1="30" x2="84" y2="34" stroke="#C8B99A" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <line x1="94" y1="36" x2="91" y2="39" stroke="#C8B99A" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <line x1="96" y1="42" x2="92" y2="42" stroke="#C8B99A" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  )
}

// ─── Slide definitions ────────────────────────────────────────────────────────
const SLIDES = [
  {
    key: 'welcome',
    dark: true,
    illustration: null,  // uses the Sown logo
    title: 'Welcome to Sown',
    subtitle: 'The knowledgeable garden companion in your pocket',
    body: 'Your personal guide to growing — from identifying what you\'ve got to knowing exactly what to do and when.',
  },
  {
    key: 'zones',
    dark: false,
    illustration: <IllustrationZones />,
    title: 'Know your garden',
    body: 'Set up zones for each area — sunny border, shaded bed, greenhouse, raised veg patch. Sown uses your conditions to tell you whether a new plant will thrive in each spot.',
    tip: 'You can skip this step and add zones later from your profile.',
  },
  {
    key: 'scan',
    dark: false,
    illustration: <IllustrationScan />,
    title: 'Scan, identify, save',
    body: 'Point your camera at a plant label in the garden centre, or use Identify mode to photograph a plant you can\'t name. One tap saves it to your personal library.',
  },
  {
    key: 'calendar',
    dark: false,
    illustration: <IllustrationCalendar />,
    title: 'Never miss a task',
    body: 'Sown follows the seasons and reminds you each month what needs doing — pruning, feeding, deadheading, winter prep. Tick off tasks as you go.',
  },
  {
    key: 'weather',
    dark: false,
    illustration: <IllustrationWeather />,
    title: 'Stay one step ahead',
    body: 'Local weather keeps you prepared — frost warnings, dry spells, ideal planting windows. Add your own notes to any plant and build a record of what works in your garden.',
  },
]

// ─── Onboarding screen ────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate    = useNavigate()
  const [index, setIndex] = useState(0)
  const touchStartX = useRef(null)

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  const finish = () => {
    localStorage.setItem('sown_onboarded', '1')
    navigate('/', { replace: true })
  }

  const next = () => {
    if (isLast) { finish(); return }
    setIndex(i => i + 1)
  }

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd   = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx < -50 && !isLast)          setIndex(i => i + 1)
    else if (dx > 50 && index > 0)    setIndex(i => i - 1)
  }

  return (
    <div
      className={`flex flex-col min-h-screen transition-colors duration-300
                  ${slide.dark ? 'bg-fern' : 'bg-parchment'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip link */}
      <div className="flex justify-end px-5 pt-5 pb-2">
        <button
          onClick={finish}
          className={`text-sm font-medium transition-colors
                      ${slide.dark ? 'text-sage/70 active:text-sage' : 'text-subtle active:text-dark'}`}
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-6 gap-6">

        {/* Illustration */}
        <div className="flex items-center justify-center">
          {slide.key === 'welcome' ? (
            <div className="flex flex-col items-center gap-3">
              <SownIcon size={72} fill={slide.dark ? '#D4DCCA' : '#4A5940'} />
              <p className={`font-serif text-3xl tracking-widest
                             ${slide.dark ? 'text-sage' : 'text-dark'}`}>
                Sown
              </p>
            </div>
          ) : (
            slide.illustration
          )}
        </div>

        {/* Text */}
        <div className="text-center max-w-xs">
          <h1 className={`font-serif text-2xl leading-tight mb-3
                          ${slide.dark ? 'text-sage' : 'text-dark'}`}>
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className={`text-sm font-medium mb-2
                           ${slide.dark ? 'text-moss' : 'text-fern'}`}>
              {slide.subtitle}
            </p>
          )}
          <p className={`text-sm leading-relaxed
                         ${slide.dark ? 'text-sage/80' : 'text-muted'}`}>
            {slide.body}
          </p>
          {slide.tip && (
            <p className={`text-xs mt-3 italic
                           ${slide.dark ? 'text-sage/50' : 'text-subtle'}`}>
              {slide.tip}
            </p>
          )}
        </div>

      </div>

      {/* Footer: dots + button */}
      <div className="px-6 pb-10 flex flex-col items-center gap-5">

        {/* Dot indicators */}
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all duration-200
                          ${i === index
                            ? (slide.dark ? 'w-5 h-2 bg-sage' : 'w-5 h-2 bg-fern')
                            : (slide.dark ? 'w-2 h-2 bg-sage/30' : 'w-2 h-2 bg-moss/50')}`}
            />
          ))}
        </div>

        {/* Next / Get started */}
        <button
          onClick={next}
          className={`w-full py-4 rounded-2xl text-base font-medium tracking-wide
                      active:opacity-80 transition-opacity
                      ${slide.dark
                        ? 'bg-sage text-fern'
                        : 'bg-fern text-sage'}`}
        >
          {isLast ? 'Get started' : 'Next'}
        </button>

        {/* Back nudge on first slide */}
        {index > 0 && (
          <button
            onClick={() => setIndex(i => i - 1)}
            className={`text-sm transition-colors
                        ${slide.dark ? 'text-sage/50 active:text-sage/80' : 'text-subtle active:text-dark'}`}
          >
            Back
          </button>
        )}

      </div>
    </div>
  )
}
