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

// ─── Daily quotes — 60 voices on gardens, nature & the living world ──────────
const DAILY_QUOTES = [
  { text: "To plant a garden is to believe in tomorrow.", author: "Audrey Hepburn" },
  { text: "The earth laughs in flowers.", author: "Ralph Waldo Emerson" },
  { text: "The love of gardening is a seed once sown that never dies.", author: "Gertrude Jekyll" },
  { text: "Adopt the pace of nature: her secret is patience.", author: "Ralph Waldo Emerson" },
  { text: "No one will protect what they don't care about; and no one will care about what they have never experienced.", author: "Sir David Attenborough" },
  { text: "The natural world is the greatest source of excitement; the greatest source of visual beauty; the greatest source of intellectual interest.", author: "Sir David Attenborough" },
  { text: "Gardening is the most therapeutic and defiant act you can do, especially in the teeth of everything that assails modern life.", author: "Monty Don" },
  { text: "In every walk with Nature, one receives far more than he seeks.", author: "John Muir" },
  { text: "The clearest way into the Universe is through a forest wilderness.", author: "John Muir" },
  { text: "Of all the paths you take in life, make sure a few of them are dirt.", author: "John Muir" },
  { text: "A garden is a grand teacher. It teaches patience and careful watchfulness.", author: "Gertrude Jekyll" },
  { text: "There is no spot of ground, however arid, bare or ugly, that cannot be tamed into such a state as may give an impression of beauty and delight.", author: "Gertrude Jekyll" },
  { text: "The most noteworthy thing about gardeners is that they are always optimistic, always enterprising, and never satisfied.", author: "Vita Sackville-West" },
  { text: "No occupation is so delightful to me as the culture of the earth, and no culture comparable to that of the garden.", author: "Thomas Jefferson" },
  { text: "God Almighty first planted a garden. And indeed it is the purest of human pleasures.", author: "Francis Bacon" },
  { text: "We must cultivate our own garden.", author: "Voltaire" },
  { text: "You can cut all the flowers but you cannot keep spring from coming.", author: "Pablo Neruda" },
  { text: "Autumn is a second spring when every leaf is a flower.", author: "Albert Camus" },
  { text: "The glory of gardening: hands in the dirt, head in the sun, heart with nature.", author: "Alfred Austin" },
  { text: "There is no gardening without humility.", author: "Alfred Austin" },
  { text: "Flowers always make people better, happier, and more helpful; they are sunshine, food and medicine for the soul.", author: "Luther Burbank" },
  { text: "The garden suggests there might be a place where we can meet nature halfway.", author: "Michael Pollan" },
  { text: "My garden is my most beautiful masterpiece.", author: "Claude Monet" },
  { text: "I perhaps owe having become a painter to flowers.", author: "Claude Monet" },
  { text: "Heaven is under our feet as well as over our heads.", author: "Henry David Thoreau" },
  { text: "I went to the woods because I wished to live deliberately.", author: "Henry David Thoreau" },
  { text: "What is the use of a house if you haven't got a tolerable planet to put it on?", author: "Henry David Thoreau" },
  { text: "One touch of nature makes the whole world kin.", author: "William Shakespeare" },
  { text: "It is rain that grows flowers, not thunder.", author: "Rumi" },
  { text: "There is something infinitely healing in the repeated refrains of nature — the assurance that dawn comes after night, and spring after winter.", author: "Rachel Carson" },
  { text: "Those who contemplate the beauty of the earth find reserves of strength that will endure as long as life lasts.", author: "Rachel Carson" },
  { text: "All gardening is landscape painting.", author: "William Kent" },
  { text: "A society grows great when old men plant trees whose shade they know they shall never sit in.", author: "Greek proverb" },
  { text: "The best fertiliser is a gardener's shadow.", author: "Old English proverb" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese proverb" },
  { text: "Come forth into the light of things, let Nature be your teacher.", author: "William Wordsworth" },
  { text: "Trees are poems that the earth writes upon the sky.", author: "Kahlil Gibran" },
  { text: "A thing of beauty is a joy forever.", author: "John Keats" },
  { text: "I believe a leaf of grass is no less than the journey-work of the stars.", author: "Walt Whitman" },
  { text: "The soil is the great connector of lives, the source and destination of all.", author: "Wendell Berry" },
  { text: "Paying attention is a form of reciprocity with the living world.", author: "Robin Wall Kimmerer" },
  { text: "The land knows you, even when you are lost.", author: "Robin Wall Kimmerer" },
  { text: "Nature always wears the colours of the spirit.", author: "Ralph Waldo Emerson" },
  { text: "We are a part of the natural world, and our future depends on its future.", author: "Sir David Attenborough" },
  { text: "The world is big and I want to have a good look at it before it gets dark.", author: "John Muir" },
  { text: "Show me your garden and I shall tell you what you are.", author: "Alfred Austin" },
  { text: "In all things of nature there is something of the marvellous.", author: "Aristotle" },
  { text: "Look deep into nature, and then you will understand everything better.", author: "Albert Einstein" },
  { text: "I go to nature to be soothed and healed, and to have my senses put in order.", author: "John Burroughs" },
  { text: "To forget how to dig the earth and to tend the soil is to forget ourselves.", author: "Mahatma Gandhi" },
  { text: "A garden requires patient labour and attention. Plants do not grow merely to satisfy ambitions or to fulfil good intentions.", author: "Liberty Hyde Bailey" },
  { text: "My green thumb came only as a result of the mistakes I made while learning to see things from the plant's point of view.", author: "H. Fred Dale" },
  { text: "There are no gardening mistakes, only experiments.", author: "Janet Kilburn Phillips" },
  { text: "The love of flowers is really the best teacher of how to grow and understand them.", author: "Max Schling" },
  { text: "Plant seeds of happiness, hope, success, and love; it will all come back to you in abundance. This is the law of nature.", author: "Steve Maraboli" },
  { text: "I must have flowers, always and always.", author: "Claude Monet" },
  { text: "To be overcome by the fragrance of flowers is a delectable form of defeat.", author: "Beverly Nichols" },
  { text: "A garden is a delight to the eye and a solace for the soul.", author: "Saadi" },
  { text: "Flowers are the music of the ground, from earth's lips spoken without sound.", author: "Edwin Curran" },
  { text: "Gardens are not made by singing 'Oh, how beautiful!' and sitting in the shade.", author: "Rudyard Kipling" },
  { text: "He who plants a tree plants a hope.", author: "Lucy Larcom" },
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

// ─── Weather helpers ──────────────────────────────────────────────────────────
function wmoLabel(code) {
  if (code === 0)  return 'Clear sky'
  if (code <= 2)   return 'Partly cloudy'
  if (code === 3)  return 'Overcast'
  if (code <= 48)  return 'Foggy'
  if (code <= 55)  return 'Drizzle'
  if (code <= 65)  return 'Rain'
  if (code <= 77)  return 'Snow'
  if (code <= 82)  return 'Showers'
  if (code <= 86)  return 'Snow showers'
  return 'Thunderstorm'
}

function wmoEmoji(code) {
  if (code === 0)  return '☀️'
  if (code <= 2)   return '⛅'
  if (code === 3)  return '☁️'
  if (code <= 48)  return '🌫️'
  if (code <= 65)  return '🌧️'
  if (code <= 77)  return '🌨️'
  if (code <= 82)  return '🌦️'
  if (code <= 86)  return '🌨️'
  return '⛈️'
}

function WeatherIcon({ code, size = 32 }) {
  const s = size
  const col = '#4A5940'
  const w = '1.5'
  if (code === 0) return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="5" stroke={col} strokeWidth={w}/>
      {[0,45,90,135,180,225,270,315].map(a => {
        const rad = a * Math.PI / 180
        return <line key={a}
          x1={16 + 8 * Math.cos(rad)} y1={16 + 8 * Math.sin(rad)}
          x2={16 + 11 * Math.cos(rad)} y2={16 + 11 * Math.sin(rad)}
          stroke={col} strokeWidth={w} strokeLinecap="round"/>
      })}
    </svg>
  )
  if (code <= 2) return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="13" cy="12" r="4" stroke={col} strokeWidth={w}/>
      <line x1="13" y1="5" x2="13" y2="7" stroke={col} strokeWidth={w} strokeLinecap="round"/>
      <line x1="6"  y1="12" x2="8" y2="12" stroke={col} strokeWidth={w} strokeLinecap="round"/>
      <line x1="18.5" y1="6.5" x2="17.1" y2="7.9" stroke={col} strokeWidth={w} strokeLinecap="round"/>
      <path d="M10 22a5 5 0 0 1 5-5h6a4 4 0 0 1 0 8h-8a3 3 0 0 1-3-3z" stroke={col} strokeWidth={w} fill="none"/>
    </svg>
  )
  if (code <= 65 || (code >= 80 && code <= 82)) return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M5 16a7 7 0 0 1 7-7h8a5 5 0 0 1 0 10H10a5 5 0 0 1-5-3z" stroke={col} strokeWidth={w} fill="none"/>
      <line x1="10" y1="23" x2="8"  y2="27" stroke={col} strokeWidth={w} strokeLinecap="round"/>
      <line x1="16" y1="23" x2="14" y2="27" stroke={col} strokeWidth={w} strokeLinecap="round"/>
      <line x1="22" y1="23" x2="20" y2="27" stroke={col} strokeWidth={w} strokeLinecap="round"/>
    </svg>
  )
  if (code <= 86) return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M5 16a7 7 0 0 1 7-7h8a5 5 0 0 1 0 10H10a5 5 0 0 1-5-3z" stroke={col} strokeWidth={w} fill="none"/>
      <circle cx="10" cy="25" r="1.5" fill={col}/>
      <circle cx="16" cy="25" r="1.5" fill={col}/>
      <circle cx="22" cy="25" r="1.5" fill={col}/>
    </svg>
  )
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <path d="M5 15a7 7 0 0 1 7-7h8a5 5 0 0 1 0 10H10a5 5 0 0 1-5-3z" stroke={col} strokeWidth={w} fill="none"/>
      <path d="M18 18l-4 5h5l-4 6" stroke={col} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Weather card ─────────────────────────────────────────────────────────────
function WeatherCard() {
  const [wx, setWx]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [place, setPlace]   = useState(null)

  useEffect(() => {
    // Serve from cache if < 2 hours old
    try {
      const cached = localStorage.getItem('sown_weather_v1')
      if (cached) {
        const { data, timestamp, locationName } = JSON.parse(cached)
        if (Date.now() - timestamp < 7200000) {
          setWx(data); setPlace(locationName); setLoading(false); return
        }
      }
    } catch {}

    const load = async () => {
      let lat = 52.4862, lon = -1.8904  // UK midlands default
      if (navigator.geolocation) {
        await new Promise(res => navigator.geolocation.getCurrentPosition(
          p => { lat = p.coords.latitude; lon = p.coords.longitude; res() },
          () => res(),
          { timeout: 5000, maximumAge: 600000 }
        ))
      }

      // Reverse geocode for place name
      let locationName = null
      try {
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const gd = await geo.json()
        locationName = gd.address?.city || gd.address?.town || gd.address?.village || null
      } catch {}

      // Fetch weather — past_days=1 gives yesterday at index 0, today at index 1
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
          `&timezone=Europe%2FLondon&forecast_days=4&past_days=1`
        )
        const raw = await res.json()
        const d = raw.daily
        const data = {
          current:   { temp: Math.round(raw.current.temperature_2m), code: raw.current.weather_code },
          today:     { max: Math.round(d.temperature_2m_max[1]), min: Math.round(d.temperature_2m_min[1]),
                       precip: d.precipitation_sum[1], code: d.weather_code[1] },
          yesterday: { precip: d.precipitation_sum[0] },
          forecast:  [2, 3, 4].map(i => ({
            date: d.time[i], max: Math.round(d.temperature_2m_max[i]), code: d.weather_code[i],
          })),
        }
        setWx(data)
        setPlace(locationName)
        try {
          localStorage.setItem('sown_weather_v1', JSON.stringify({ data, timestamp: Date.now(), locationName }))
        } catch {}
      } catch {
        // silent — card just doesn't render
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="bg-white border border-moss/40 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-moss/10 animate-pulse flex-shrink-0"/>
        <div className="flex-1">
          <div className="h-3 w-20 bg-moss/10 rounded animate-pulse mb-2"/>
          <div className="h-2.5 w-32 bg-moss/10 rounded animate-pulse"/>
        </div>
        <div className="h-7 w-10 bg-moss/10 rounded animate-pulse"/>
      </div>
    </div>
  )

  if (!wx) return null

  // Gardening hint — most useful contextual message for right now
  let hint = null
  if (wx.today.min <= 0)
    hint = 'Frost likely tonight — protect tender plants now'
  else if (wx.today.min <= 2)
    hint = 'Near-freezing tonight — bring in tender pots'
  else if (wx.yesterday.precip > 8)
    hint = 'Good rainfall yesterday — hold off watering today'
  else if (wx.today.precip > 5)
    hint = 'Rain expected today — soil should stay moist'
  else if (wx.today.code === 0 && wx.today.max > 22)
    hint = 'Hot and sunny — water plants in the evening to reduce evaporation'
  else if (wx.yesterday.precip < 1 && wx.today.precip < 1 && wx.today.max > 18)
    hint = 'Dry spell — check soil moisture and water if needed'

  const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  return (
    <div className="bg-white border border-moss/40 rounded-xl overflow-hidden">
      {/* Current conditions */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <WeatherIcon code={wx.current.code} size={36}/>
        <div className="flex-1 min-w-0">
          {place && (
            <p className="text-[10px] text-subtle uppercase tracking-widest mb-0.5">{place}</p>
          )}
          <p className="text-sm font-medium text-dark leading-tight">{wmoLabel(wx.today.code)}</p>
          <p className="text-xs text-subtle mt-0.5">H {wx.today.max}° · L {wx.today.min}°</p>
        </div>
        <p className="font-serif text-dark text-3xl leading-none flex-shrink-0">
          {wx.current.temp}°
        </p>
      </div>

      {/* Gardening hint */}
      {hint && (
        <div className="mx-4 mb-3 bg-leaf rounded-lg px-3 py-2">
          <p className="text-xs text-dark leading-relaxed">{hint}</p>
        </div>
      )}

      {/* 3-day forecast */}
      <div className="border-t border-moss/20 px-4 py-3 flex justify-around">
        {wx.forecast.map(day => {
          const dayName = DAY[new Date(day.date + 'T12:00:00').getDay()]
          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <p className="text-[10px] text-subtle font-medium uppercase tracking-wide">{dayName}</p>
              <span className="text-base leading-none">{wmoEmoji(day.code)}</span>
              <p className="text-xs text-dark font-medium">{day.max}°</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Home screen ─────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [plantCount, setPlantCount] = useState(null)
  const [zoneCount, setZoneCount]   = useState(null)
  const [userPlants, setUserPlants] = useState([])
  const [loading, setLoading]       = useState(true)

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

  // Today's quote — cycles by day of year so it changes daily
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const todayQuote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]

  // Compute tasks inline during render — same pattern as Calendar
  const thisMonthTasks = getTasksForMonth(monthIndex, userPlants, true)

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

        // Plant care data — same query pattern as Calendar
        const { data: plantsData } = await supabase
          .from('user_plants')
          .select('id, location, plants(common_name, photo_url, care_calendar, pruning_when, pruning_how, watering, winter_care, flowering_season)')
          .eq('user_id', authUser.id)

        setUserPlants(plantsData || [])
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
              "{todayQuote.text}"
            </p>
            <p className="text-xs text-subtle mt-2">— {todayQuote.author}</p>
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

        {/* Today's thought — daily quote, always visible */}
        <div className="bg-white border border-moss/40 rounded-xl p-4">
          <p className="text-[10px] text-subtle uppercase tracking-widest mb-2">
            Today's thought
          </p>
          <p className="font-serif text-dark text-sm leading-relaxed italic">
            "{todayQuote.text}"
          </p>
          <p className="text-xs text-subtle mt-2">— {todayQuote.author}</p>
        </div>

        {/* Weather placeholder */}
        <WeatherCard />

      </main>
    </div>
  )
}
