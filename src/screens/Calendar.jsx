// src/screens/Calendar.jsx
// Sown App — Garden Calendar screen
// Paste this file into src/screens/Calendar.jsx
//
// What this does:
//   1. Shows personalised monthly care tasks based on the user's plant library
//   2. Displays a month navigator to scroll through the year
//   3. Groups tasks by plant with botanical illustration thumbnails
//   4. Shows a live frost risk indicator via Open-Meteo API (free, no key needed)
//   5. Highlights urgent tasks (this week) vs upcoming tasks
//   6. Pro-only weather alerts shown with upgrade prompt for free users
//
// APIs used:
//   Open-Meteo — free, no API key required
//   https://open-meteo.com/

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import SownIcon from '../components/SownIcon'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const SHORT_MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
]

// Leeds coordinates — replace with user's location from browser geolocation
const DEFAULT_LAT = 53.8008
const DEFAULT_LON = -1.5491
const DEFAULT_LOCATION = 'Leeds'

// ─── Botanical thumbnail ──────────────────────────────────────────────────────
function BotanicalThumb({ name = '', color = '#4A5940', size = 32 }) {
  const seed = name.charCodeAt(0) % 4
  const s = size
  const variants = [
    <svg key="a" width={s} height={s} viewBox="0 0 36 36" fill="none">
      <line x1="18" y1="32" x2="18" y2="18" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="18" y1="26" x2="13" y2="22" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
      <ellipse cx="18" cy="14" rx="6" ry="7" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 1.5"/>
      <circle cx="18" cy="14" r="2.5" fill="none" stroke={color} strokeWidth="0.8"/>
    </svg>,
    <svg key="b" width={s} height={s} viewBox="0 0 36 36" fill="none">
      <line x1="18" y1="32" x2="18" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <ellipse cx="12" cy="20" rx="7" ry="5" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="1.5 1.5" transform="rotate(-30 12 20)"/>
      <ellipse cx="24" cy="16" rx="7" ry="5" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="1.5 1.5" transform="rotate(30 24 16)"/>
    </svg>,
    <svg key="c" width={s} height={s} viewBox="0 0 36 36" fill="none">
      <line x1="18" y1="32" x2="18" y2="20" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="18" cy="14" r="8" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 1.5"/>
      <circle cx="18" cy="14" r="3" fill="none" stroke={color} strokeWidth="0.8"/>
      <line x1="18" y1="6" x2="18" y2="10" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      <line x1="10" y1="14" x2="14" y2="14" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      <line x1="22" y1="14" x2="26" y2="14" stroke={color} strokeWidth="0.8" opacity="0.5"/>
    </svg>,
    <svg key="d" width={s} height={s} viewBox="0 0 36 36" fill="none">
      <line x1="18" y1="32" x2="18" y2="8" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <ellipse cx="18" cy="10" rx="4" ry="6" fill="none" stroke={color} strokeWidth="1" strokeDasharray="1.5 1"/>
      <line x1="18" y1="24" x2="12" y2="19" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
      <line x1="18" y1="20" x2="24" y2="15" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
    </svg>,
  ]
  return variants[seed]
}

// ─── Urgency dot ──────────────────────────────────────────────────────────────
function UrgencyBar({ urgency }) {
  const styles = {
    urgent:   'bg-clay',
    soon:     'bg-moss',
    upcoming: 'bg-subtle/40',
  }
  return <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${styles[urgency] || 'bg-subtle/40'}`} />
}

// ─── Task card ────────────────────────────────────────────────────────────────
function TaskCard({ task }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className="w-full bg-white border border-moss/40 rounded-xl
                 p-3 flex gap-3 items-start text-left
                 active:bg-leaf transition-colors"
    >
      {/* Urgency bar */}
      <UrgencyBar urgency={task.urgency} />

      {/* Botanical thumb */}
      <div className="w-10 h-10 bg-leaf rounded-lg flex items-center
                      justify-center flex-shrink-0">
        <BotanicalThumb name={task.plant_name} size={24} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-serif text-dark text-sm leading-tight">
            {task.plant_name}
          </p>
          {task.urgency === 'urgent' && (
            <span className="text-[10px] bg-clay/20 text-clay px-2 py-0.5
                             rounded-full flex-shrink-0 font-medium">
              This week
            </span>
          )}
        </div>

        <p className="text-sm text-fern font-medium mt-0.5">
          {task.action}
        </p>

        {expanded && (
          <p className="text-xs text-muted leading-relaxed mt-1.5 italic">
            {task.detail}
          </p>
        )}

        {!expanded && (
          <p className="text-[10px] text-subtle mt-1 tracking-wide">
            Tap for detail
          </p>
        )}
      </div>
    </button>
  )
}

// ─── Frost indicator ──────────────────────────────────────────────────────────
function FrostIndicator({ frostData, location, isPro, onUpgrade }) {
  if (!isPro) {
    return (
      <button
        onClick={onUpgrade}
        className="w-full bg-fern/10 border border-fern/20 rounded-xl
                   px-4 py-3 flex items-center justify-between
                   active:bg-fern/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🌡️</span>
          <div className="text-left">
            <p className="text-xs font-medium text-fern">Frost & weather alerts</p>
            <p className="text-xs text-subtle">Available with Sown Pro</p>
          </div>
        </div>
        <span className="text-xs bg-fern text-sage px-3 py-1
                         rounded-full font-medium flex-shrink-0">
          Upgrade
        </span>
      </button>
    )
  }

  if (!frostData) {
    return (
      <div className="bg-leaf rounded-xl px-4 py-3 flex items-center gap-2">
        <div className="w-3 h-3 border border-moss/40 border-t-fern
                        rounded-full animate-spin flex-shrink-0" />
        <p className="text-xs text-subtle">Fetching weather for {location}...</p>
      </div>
    )
  }

  const { minTemp, frostRisk, description } = frostData
  const riskColour = {
    none:   'bg-leaf text-fern border-moss/40',
    low:    'bg-leaf text-fern border-moss/40',
    medium: 'bg-clay/10 text-clay border-clay/30',
    high:   'bg-red-50 text-red-700 border-red-200',
  }[frostRisk] || 'bg-leaf text-fern border-moss/40'

  return (
    <div className={`rounded-xl px-4 py-3 border flex items-center
                     justify-between ${riskColour}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">
          {frostRisk === 'high' ? '❄️' : frostRisk === 'medium' ? '🌡️' : '☀️'}
        </span>
        <div>
          <p className="text-xs font-medium">{description}</p>
          <p className="text-xs opacity-70">
            Tonight's low: {minTemp}°C · {location}
          </p>
        </div>
      </div>
      <span className="text-xs font-medium capitalize flex-shrink-0 ml-2">
        {frostRisk === 'none' ? 'No frost' :
         frostRisk === 'low'  ? 'Low risk' :
         frostRisk === 'medium' ? 'Caution' : 'Frost likely'}
      </span>
    </div>
  )
}

// ─── Month navigator ──────────────────────────────────────────────────────────
function MonthNav({ month, year, onChange }) {
  const prev = () => {
    if (month === 0) onChange(11, year - 1)
    else onChange(month - 1, year)
  }
  const next = () => {
    if (month === 11) onChange(0, year + 1)
    else onChange(month + 1, year)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        onClick={prev}
        className="w-9 h-9 bg-leaf rounded-full flex items-center
                   justify-center active:bg-moss/30 transition-colors"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
          stroke="#4A5940" strokeWidth="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      <div className="text-center">
        <h2 className="font-serif text-dark text-xl">
          {MONTHS[month]}
        </h2>
        <p className="text-xs text-subtle">{year}</p>
      </div>

      <button
        onClick={next}
        className="w-9 h-9 bg-leaf rounded-full flex items-center
                   justify-center active:bg-moss/30 transition-colors"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
          stroke="#4A5940" strokeWidth="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Month strip (horizontal scroll) ─────────────────────────────────────────
function MonthStrip({ month, year, onChange }) {
  return (
    <div className="flex gap-1 px-4 pb-3 overflow-x-auto
                    scrollbar-none [-ms-overflow-style:none]
                    [&::-webkit-scrollbar]:hidden">
      {SHORT_MONTHS.map((m, i) => (
        <button
          key={m}
          onClick={() => onChange(i, year)}
          className={`flex-shrink-0 w-10 py-1.5 rounded-lg text-xs
                      font-medium tracking-wide transition-colors
                      ${month === i
                        ? 'bg-fern text-sage'
                        : 'bg-white border border-moss/40 text-subtle'
                      }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyMonth({ month, onScan }) {
  return (
    <div className="flex flex-col items-center justify-center
                    py-14 px-6 text-center gap-4">
      <div className="w-16 h-16 bg-leaf rounded-full flex items-center
                      justify-center">
        <SownIcon size={32} fill="#44593b" />
      </div>
      <div>
        <p className="font-serif text-dark text-lg mb-1">
          Nothing scheduled for {MONTHS[month]}
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Add more plants to your library to build a fuller care calendar.
        </p>
      </div>
      <button
        onClick={onScan}
        className="bg-fern text-sage text-sm font-medium
                   px-6 py-3 rounded-xl tracking-wide
                   active:opacity-80 transition-opacity"
      >
        Scan a plant
      </button>
    </div>
  )
}

// ─── Upgrade sheet ────────────────────────────────────────────────────────────
function UpgradeSheet({ onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-dark/40 z-40" onClick={onClose}/>
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                      bg-parchment rounded-t-2xl z-50 pb-safe">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-moss rounded-full"/>
        </div>
        <div className="px-5 pb-8 flex flex-col gap-4">
          <div className="bg-fern rounded-xl p-4 text-center">
            <div className="flex justify-center mb-3">
              <SownIcon size={40} fill="#D4DCCA"/>
            </div>
            <p className="font-serif text-sage text-xl mb-1">Sown Pro</p>
            <p className="text-moss text-sm">£2.99/month or £19.99/year</p>
          </div>
          <div className="flex flex-col gap-2">
            {[
              'Frost & weather alerts for your location',
              'Unlimited plant library',
              'Full personalised care calendar',
              'Companion planting suggestions',
              'Garden photo journal',
            ].map(feature => (
              <div key={feature} className="flex gap-2 items-start">
                <span className="text-fern text-sm flex-shrink-0 mt-0.5">✦</span>
                <p className="text-sm text-muted">{feature}</p>
              </div>
            ))}
          </div>
          <button className="w-full bg-fern text-sage font-medium
                             py-4 rounded-xl tracking-wide text-sm
                             active:opacity-80 transition-opacity">
            Upgrade to Pro
          </button>
          <button onClick={onClose}
            className="text-subtle text-sm text-center">
            Maybe later
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main Calendar screen ─────────────────────────────────────────────────────
export default function Calendar() {
  const navigate = useNavigate()
  const now      = new Date()

  // ── State ──────────────────────────────────────────────────────────────────
  const [month, setMonth]           = useState(now.getMonth())
  const [year, setYear]             = useState(now.getFullYear())
  const [frostData, setFrostData]   = useState(null)
  const [location, setLocation]     = useState(DEFAULT_LOCATION)
  const [showUpgrade, setUpgrade]   = useState(false)
  const [userPlants, setUserPlants] = useState([])
  const [loading, setLoading]       = useState(true)

  // ── Fetch user's plants with care calendars ────────────────────────────────
  useEffect(() => {
    const fetchPlants = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('user_plants')
          .select('id, plants(common_name, latin_name, care_calendar)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
        setUserPlants(data || [])
      } finally {
        setLoading(false)
      }
    }
    fetchPlants()
  }, [])

  // ── Pro status (extend later from user_metadata.is_pro) ───────────────────
  const isPro = false

  // ── Fetch frost data (Open-Meteo — free, no key needed) ────────────────────
  useEffect(() => {
    if (!isPro) return

    const fetchFrost = async () => {
      try {
        // Try to get user's actual location
        let lat = DEFAULT_LAT
        let lon = DEFAULT_LON

        if (navigator.geolocation) {
          await new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
              pos => {
                lat = pos.coords.latitude
                lon = pos.coords.longitude
                resolve()
              },
              () => resolve(), // fall back to Leeds on error
              { timeout: 3000 }
            )
          })
        }

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?` +
          `latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_min` +
          `&timezone=Europe%2FLondon` +
          `&forecast_days=1`
        )
        const data = await res.json()
        const minTemp = Math.round(data.daily.temperature_2m_min[0])

        let frostRisk = 'none'
        if (minTemp <= 0)  frostRisk = 'high'
        else if (minTemp <= 2) frostRisk = 'medium'
        else if (minTemp <= 5) frostRisk = 'low'

        const descriptions = {
          none:   'No frost risk tonight',
          low:    'Cool night — watch tender plants',
          medium: 'Near-freezing — consider covering dahlias',
          high:   'Frost likely — protect tender plants now',
        }

        setFrostData({ minTemp, frostRisk, description: descriptions[frostRisk] })
      } catch {
        setFrostData({ minTemp: '—', frostRisk: 'none', description: 'Weather data unavailable' })
      }
    }

    fetchFrost()
  }, [isPro])

  // ── Get tasks for the selected month ──────────────────────────────────────
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()
  const tasks = getTasksForMonth(month, userPlants, isCurrentMonth)

  // ── Group tasks by urgency ─────────────────────────────────────────────────
  const urgent   = tasks.filter(t => t.urgency === 'urgent')
  const soon     = tasks.filter(t => t.urgency === 'soon')
  const upcoming = tasks.filter(t => t.urgency === 'upcoming')

  const handleMonthChange = (m, y) => {
    setMonth(m)
    setYear(y)
    setFrostData(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-3 px-4 pt-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-moss/10 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* Month navigator */}
          <MonthNav month={month} year={year} onChange={handleMonthChange} />

          {/* Month strip */}
          <MonthStrip month={month} year={year} onChange={handleMonthChange} />
        </>
      )}

      {!loading && <main className="flex-1 flex flex-col gap-3 px-4 pb-4">

        {/* Frost indicator */}
        <FrostIndicator
          frostData={frostData}
          location={location}
          isPro={isPro}
          onUpgrade={() => setUpgrade(true)}
        />

        {/* Task count summary */}
        {tasks.length > 0 && (
          <div className="flex gap-2">
            {urgent.length > 0 && (
              <div className="flex-1 bg-clay/10 border border-clay/30
                              rounded-xl px-3 py-2 text-center">
                <p className="text-lg font-serif text-clay">{urgent.length}</p>
                <p className="text-[10px] text-clay/70 uppercase tracking-widest">
                  This week
                </p>
              </div>
            )}
            {soon.length > 0 && (
              <div className="flex-1 bg-leaf border border-moss/40
                              rounded-xl px-3 py-2 text-center">
                <p className="text-lg font-serif text-fern">{soon.length}</p>
                <p className="text-[10px] text-subtle uppercase tracking-widest">
                  Coming up
                </p>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="flex-1 bg-white border border-moss/40
                              rounded-xl px-3 py-2 text-center">
                <p className="text-lg font-serif text-muted">{upcoming.length}</p>
                <p className="text-[10px] text-subtle uppercase tracking-widest">
                  This month
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tasks or empty state */}
        {tasks.length === 0 ? (
          <EmptyMonth month={month} onScan={() => navigate('/scan')} />
        ) : (
          <>
            {/* Urgent tasks */}
            {urgent.length > 0 && (
              <section>
                <p className="text-xs text-clay font-medium uppercase
                              tracking-widest mb-2">
                  This week
                </p>
                <div className="flex flex-col gap-2">
                  {urgent.map(t => <TaskCard key={t.id} task={t} />)}
                </div>
              </section>
            )}

            {/* Soon tasks */}
            {soon.length > 0 && (
              <section>
                <p className="text-xs text-fern font-medium uppercase
                              tracking-widest mb-2 mt-1">
                  Coming up
                </p>
                <div className="flex flex-col gap-2">
                  {soon.map(t => <TaskCard key={t.id} task={t} />)}
                </div>
              </section>
            )}

            {/* Upcoming tasks */}
            {upcoming.length > 0 && (
              <section>
                <p className="text-xs text-subtle font-medium uppercase
                              tracking-widest mb-2 mt-1">
                  This month
                </p>
                <div className="flex flex-col gap-2">
                  {upcoming.map(t => <TaskCard key={t.id} task={t} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* Sown Pro nudge at bottom (free users only) */}
        {!isPro && tasks.length > 0 && (
          <button
            onClick={() => setUpgrade(true)}
            className="w-full bg-fern/5 border border-fern/20 rounded-xl
                       px-4 py-3 text-center active:bg-fern/10
                       transition-colors"
          >
            <p className="text-xs font-medium text-fern">
              Unlock frost alerts & full calendar with Sown Pro
            </p>
            <p className="text-xs text-subtle mt-0.5">£19.99/year</p>
          </button>
        )}

      </main>}

      {/* Upgrade sheet */}
      {showUpgrade && <UpgradeSheet onClose={() => setUpgrade(false)} />}
    </div>
  )
}

// ─── Care calendar logic ───────────────────────────────────────────────────────
// Reads from the care_calendar JSONB column on the plants table.
// Each entry: { month: 1–12, task: string, detail: string }

function getTasksForMonth(month, userPlants, isCurrentMonth) {
  const tasks       = []
  const now         = new Date()
  const weekOfMonth = Math.ceil(now.getDate() / 7)
  const calMonth    = month + 1  // care_calendar uses 1-indexed months

  userPlants.forEach(row => {
    const plant = row.plants
    if (!plant?.care_calendar) return

    const monthEntries = plant.care_calendar.filter(e => e.month === calMonth)
    if (monthEntries.length === 0) return

    monthEntries.forEach((entry, idx) => {
      let urgency = 'upcoming'
      if (isCurrentMonth) {
        urgency = (idx === 0 && weekOfMonth <= 2) ? 'urgent' : 'soon'
      }
      tasks.push({
        id:         `${row.id}-${calMonth}-${idx}`,
        plant_name: plant.common_name,
        action:     entry.task,
        detail:     entry.detail,
        urgency,
      })
    })
  })

  const order = { urgent: 0, soon: 1, upcoming: 2 }
  return tasks.sort((a, b) => order[a.urgency] - order[b.urgency])
}
