import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { requestPushPermission } from '../lib/pushNotifications'
import { getTasksForMonth, normaliseCategory } from '../lib/careCalendar'
import TopBar from '../components/TopBar'

// ─── Seasonal tips — shown when the user has plants ──────────────────────────
const SEASONAL_TIPS = [
  "Plan this year's garden. Order seed catalogues and start dreaming.",         // Jan
  "Start sweet peas indoors. Check stored tubers and bulbs for rot.",           // Feb
  "Sow hardy annuals under glass. Divide perennial clumps before growth peaks.",// Mar
  "Plant out brassica seedlings. Watch for slugs as new growth emerges.",       // Apr
  "Plant out tender bedding after the last frost has passed.",                  // May
  "Deadhead roses regularly to encourage more blooms. Water in dry spells.",    // Jun
  "Harvest lavender as it opens. Water containers daily in the heat.",          // Jul
  "Collect seed from favourite plants. Take cuttings of tender perennials.",    // Aug
  "Plant spring bulbs now for colour next April. Lift dahlias after first frost.", // Sep
  "Plant garlic cloves now. Clear spent beds and add a thick layer of compost.",// Oct
  "Protect half-hardy plants from frost. Plant bare-root roses and hedging.",   // Nov
  "Rest and plan. Sharpen tools, order seeds and look forward to spring.",      // Dec
]

// ─── Gardening quotes — shown when the library is empty ──────────────────────
const QUOTES = [
  { text: "The love of gardening is a seed once sown that never dies.", author: "Gertrude Jekyll" },
  { text: "To plant a garden is to believe in tomorrow.", author: "Audrey Hepburn" },
  { text: "All gardening is landscape painting.", author: "William Kent" },
  { text: "The best fertiliser is a gardener's shadow.", author: "Old English proverb" },
  { text: "A garden is a grand teacher. It teaches patience and careful watchfulness.", author: "Gertrude Jekyll" },
  { text: "In every walk with Nature, one receives far more than he seeks.", author: "John Muir" },
  { text: "A society grows great when old men plant trees whose shade they know they shall never sit in.", author: "Greek proverb" },
]

// ─── Push notification prompt card ───────────────────────────────────────────
function PushPromptCard({ onEnable, onDismiss }) {
  return (
    <div className="bg-leaf border border-fern/30 rounded-xl p-4
                    flex items-start gap-3">
      {/* Bell icon */}
      <div className="w-9 h-9 bg-fern/20 rounded-lg flex items-center
                      justify-center flex-shrink-0 mt-0.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#4A5940" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-dark leading-snug">
          Monthly garden reminders
        </p>
        <p className="text-xs text-subtle mt-0.5 leading-relaxed">
          Get a notification on the 1st of each month with tasks for your plants.
        </p>

        <div className="flex gap-2 mt-3">
          <button
            onClick={onEnable}
            className="flex-1 bg-fern text-sage text-xs font-medium
                       py-2 rounded-lg active:opacity-80 transition-opacity"
          >
            Enable reminders
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 bg-white/60 text-subtle text-xs font-medium
                       py-2 rounded-lg active:opacity-70 transition-opacity"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Weather placeholder ──────────────────────────────────────────────────────
function WeatherCard() {
  const month = new Date().toLocaleString('en-GB', { month: 'long' })
  const day   = new Date().toLocaleString('en-GB', { weekday: 'long' })
  return (
    <div className="bg-white border border-moss/40 rounded-xl p-4
                    flex items-center justify-between">
      <div>
        <p className="text-xs text-subtle uppercase tracking-widest mb-0.5">
          {day}, {month}
        </p>
        <p className="text-sm text-muted">Weather integration coming soon</p>
      </div>
      {/* Cloud / sun icon */}
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none"
           className="opacity-30 flex-shrink-0">
        <circle cx="22" cy="14" r="7" stroke="#4A5940" strokeWidth="1.5"/>
        <path d="M6 22a6 6 0 0 1 6-6h14a5 5 0 0 1 0 10H10a4 4 0 0 1-4-4Z"
          stroke="#4A5940" strokeWidth="1.5" fill="none"/>
      </svg>
    </div>
  )
}

// ─── Main Home screen ─────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [plantCount, setPlantCount]     = useState(null)
  const [zoneCount, setZoneCount]       = useState(null)
  const [thisMonthTasks, setMonthTasks] = useState([])
  const [loading, setLoading]           = useState(true)

  // Show soft push prompt if browser supports it and user hasn't been asked or dismissed
  const [showPushPrompt, setShowPushPrompt] = useState(() => {
    if (typeof window === 'undefined') return false
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
    if (Notification.permission !== 'default') return false
    if (localStorage.getItem('sown_push_asked') || localStorage.getItem('sown_push_dismissed')) return false
    return !!(import.meta.env.VITE_VAPID_PUBLIC_KEY)
  })

  // Prefer dedicated forename field; fall back to first word of full_name, then email prefix
  const forename  = user?.user_metadata?.forename || ''
  const fullName  = user?.user_metadata?.full_name || ''
  const firstName = forename || fullName.split(' ')[0] || user?.email?.split('@')[0] || null

  // Greeting changes by time of day
  const hour     = new Date().getHours()
  const timeWord = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const greeting = firstName ? `Good ${timeWord}, ${firstName}` : `Good ${timeWord}`

  // Seasonal tip for this month, or a rotating quote when no plants
  const monthIndex = new Date().getMonth()         // 0–11
  const seasonalTip = SEASONAL_TIPS[monthIndex]
  const quote = QUOTES[new Date().getDate() % QUOTES.length]  // cycles by day of month

  useEffect(() => {
    const fetchCounts = async () => {
      setLoading(true)
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return

        // Counts
        const [{ count: plants }, { count: zones }] = await Promise.all([
          supabase.from('user_plants').select('id', { count: 'exact', head: true }).eq('user_id', authUser.id),
          supabase.from('garden_zones').select('id', { count: 'exact', head: true }).eq('user_id', authUser.id),
        ])
        setPlantCount(plants ?? 0)
        setZoneCount(zones ?? 0)

        // Plant care data — fetched separately to match Calendar's working pattern
        const { data: plantsData } = await supabase
          .from('user_plants')
          .select('id, location, plants(common_name, photo_url, care_calendar, pruning_when, pruning_how, watering, winter_care, flowering_season)')
          .eq('user_id', authUser.id)

        if (plantsData) {
          const now = new Date()
          setMonthTasks(getTasksForMonth(now.getMonth(), plantsData, true))
        }
      } finally {
        setLoading(false)
      }
    }
    fetchCounts()

  }, [])

  const handleEnablePush = async () => {
    setShowPushPrompt(false)
    localStorage.setItem('sown_push_asked', '1')
    await requestPushPermission()
  }

  const handleDismissPush = () => {
    setShowPushPrompt(false)
    localStorage.setItem('sown_push_dismissed', '1')
  }

  const hasPlants = !loading && plantCount !== null && plantCount > 0

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />

      <main className="flex-1 p-4 flex flex-col gap-3">

        {/* Greeting */}
        <div className="pt-1">
          <p className="font-serif text-dark text-2xl leading-snug">
            {greeting}
          </p>
          <p className="text-sm text-subtle mt-0.5">
            {hasPlants
              ? `You have ${plantCount} ${plantCount === 1 ? 'plant' : 'plants'} in your garden`
              : "Let's start building your garden"}
          </p>
        </div>

        {/* This month card — skeleton → real tasks → quote fallback */}
        {loading ? (
          <div className="bg-leaf rounded-xl p-4 border-l-[3px] border-fern">
            <div className="h-2.5 w-20 bg-fern/20 rounded animate-pulse mb-3" />
            <div className="h-3 w-full bg-moss/20 rounded animate-pulse mb-1.5" />
            <div className="h-3 w-3/4 bg-moss/20 rounded animate-pulse" />
          </div>
        ) : hasPlants && thisMonthTasks.length > 0 ? (() => {
          const categories = [...new Set(thisMonthTasks.map(t => normaliseCategory(t.action)))]
          const top = thisMonthTasks[0]
          return (
            <button
              onClick={() => navigate('/calendar')}
              className="bg-leaf rounded-xl p-4 border-l-[3px] border-fern
                         text-left w-full active:opacity-80 transition-opacity"
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold text-fern tracking-widest uppercase">
                  This month
                </p>
                <p className="text-[10px] text-subtle">
                  {thisMonthTasks.length} task{thisMonthTasks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <p className="text-sm text-dark leading-relaxed">
                {top.action} your {top.plant_name}
                {categories.length > 1 && (
                  <span className="text-subtle">
                    {' '}and {thisMonthTasks.length - 1} more
                  </span>
                )}
              </p>
              {categories.length > 1 && (
                <p className="text-xs text-subtle mt-1">
                  {categories.join(' · ')}
                </p>
              )}
              <p className="text-xs text-fern font-medium mt-2">
                View calendar →
              </p>
            </button>
          )
        })() : hasPlants ? (
          <div className="bg-leaf rounded-xl p-4 border-l-[3px] border-fern">
            <p className="text-[10px] font-semibold text-fern mb-1.5
                          tracking-widest uppercase">
              This month
            </p>
            <p className="text-sm text-dark leading-relaxed">{seasonalTip}</p>
          </div>
        ) : (
          <div className="bg-leaf rounded-xl p-4 border-l-[3px] border-fern">
            <p className="text-[10px] font-semibold text-fern mb-1.5
                          tracking-widest uppercase">
              Growing wisdom
            </p>
            <p className="text-sm text-dark leading-relaxed italic">
              "{quote.text}"
            </p>
            <p className="text-xs text-subtle mt-2">— {quote.author}</p>
          </div>
        )}

        {/* Scan CTA — primary action */}
        <button
          onClick={() => navigate('/scan')}
          className="bg-fern rounded-2xl px-5 py-5 flex items-center
                     justify-between gap-3
                     active:opacity-80 transition-opacity"
        >
          <div className="text-left">
            <p className="text-sage font-serif text-lg leading-tight">
              Scan a plant
            </p>
            <p className="text-moss text-xs mt-0.5">
              Point your camera at a label or plant
            </p>
          </div>
          {/* Camera icon */}
          <div className="w-12 h-12 bg-dark/20 rounded-xl flex items-center
                          justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="#D4DCCA" strokeWidth="1.5" strokeLinecap="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        </button>

        {/* Library summary */}
        <button
          onClick={() => navigate('/library')}
          className="bg-white border border-moss/40 rounded-xl p-4
                     flex items-center justify-between
                     active:bg-leaf transition-colors text-left w-full"
        >
          <div>
            <p className="text-xs text-subtle uppercase tracking-widest mb-0.5">
              My garden library
            </p>
            {loading ? (
              <div className="h-4 w-24 bg-moss/20 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-sm text-dark font-medium">
                {plantCount === 0
                  ? 'No plants saved yet'
                  : `${plantCount} ${plantCount === 1 ? 'plant' : 'plants'} saved`}
              </p>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="#8A7E6E" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        {/* Garden zones */}
        <button
          onClick={() => navigate('/zones')}
          className="bg-white border border-moss/40 rounded-xl p-4
                     flex items-center justify-between
                     active:bg-leaf transition-colors text-left w-full"
        >
          <div>
            <p className="text-xs text-subtle uppercase tracking-widest mb-0.5">
              My garden zones
            </p>
            {loading ? (
              <div className="h-4 w-24 bg-moss/20 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-sm text-dark font-medium">
                {zoneCount === 0
                  ? 'No zones set up yet'
                  : `${zoneCount} ${zoneCount === 1 ? 'zone' : 'zones'} defined`}
              </p>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="#8A7E6E" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        {/* Push notification soft prompt */}
        {showPushPrompt && (
          <PushPromptCard
            onEnable={handleEnablePush}
            onDismiss={handleDismissPush}
          />
        )}

        {/* Weather placeholder */}
        <WeatherCard />

      </main>
    </div>
  )
}
