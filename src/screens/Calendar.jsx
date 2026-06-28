import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTasksForMonth, normaliseCategory } from '../lib/careCalendar'
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

// ─── Category normalisation ────────────────────────────────────────────────────
// Groups similar task verbs into display categories with an icon
const CATEGORY_MAP = [
  { key: 'Pruning',            icon: '✂️', test: a => /prun/i.test(a) },
  { key: 'Watering',           icon: '💧', test: a => /water/i.test(a) },
  { key: 'Deadheading',        icon: '🌸', test: a => /deadhead|dead head/i.test(a) },
  { key: 'Feeding',            icon: '🌿', test: a => /feed|fertili/i.test(a) },
  { key: 'Mulching',           icon: '🍂', test: a => /mulch/i.test(a) },
  { key: 'Winter care',        icon: '❄️', test: a => /winter|protect/i.test(a) },
  { key: 'Planting & sowing',  icon: '🌱', test: a => /plant|sow/i.test(a) },
  { key: 'Lifting & dividing', icon: '🪴', test: a => /lift|divid/i.test(a) },
  { key: 'Planning',           icon: '📋', test: a => /plan/i.test(a) },
]

function normaliseCategory(action = '') {
  for (const { key, test } of CATEGORY_MAP) {
    if (test(action)) return key
  }
  return action || 'Other'
}

function categoryIcon(cat) {
  return CATEGORY_MAP.find(c => c.key === cat)?.icon ?? '🌿'
}

function groupByCategory(tasks) {
  const groups = {}
  tasks.forEach(t => {
    const cat = normaliseCategory(t.action)
    ;(groups[cat] ??= []).push(t)
  })
  return groups
}

// ─── Completion key (no year — fetched per year already) ──────────────────────
const completionKey = (t) => `${t.user_plant_id}-${t.month}-${t.action}`

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

// ─── Task card ────────────────────────────────────────────────────────────────
function TaskCard({ task, isComplete, onToggle, toggling }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`w-full border rounded-xl p-3 flex gap-3 items-start
                     transition-colors
                     ${isComplete
                       ? 'bg-leaf/50 border-fern/20'
                       : 'bg-white border-moss/40'}`}
    >
      {/* Urgent badge bar */}
      {task.urgency === 'urgent' && !isComplete && (
        <div className="w-1 self-stretch bg-clay rounded-full flex-shrink-0" />
      )}

      {/* Plant thumbnail — photo if available, botanical illustration fallback */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden
                   active:opacity-70 flex-shrink-0"
      >
        {task.photo_url ? (
          <img
            src={task.photo_url}
            alt={task.plant_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-leaf flex items-center justify-center">
            <BotanicalThumb name={task.plant_name} size={24} />
          </div>
        )}
      </button>

      {/* Content */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`font-serif text-sm leading-tight
                         ${isComplete ? 'text-subtle line-through' : 'text-dark'}`}>
            {task.plant_name}
          </p>
          {task.urgency === 'urgent' && !isComplete && (
            <span className="text-[10px] bg-clay/20 text-clay px-1.5 py-0.5
                             rounded-full font-medium flex-shrink-0">
              this week
            </span>
          )}
        </div>
        {task.location && (
          <p className="text-[10px] text-fern font-medium mt-0.5 tracking-wide">
            {task.location}
          </p>
        )}

        {expanded ? (
          <p className="text-xs text-muted leading-relaxed mt-1 italic">
            {task.detail}
          </p>
        ) : (
          <p className="text-xs text-subtle mt-0.5 leading-snug line-clamp-1">
            {task.detail}
          </p>
        )}
      </button>

      {/* Tick button */}
      <button
        onClick={onToggle}
        disabled={toggling}
        aria-label={isComplete ? 'Mark incomplete' : 'Mark complete'}
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center
                    flex-shrink-0 transition-colors active:opacity-70
                    disabled:opacity-40
                    ${isComplete
                      ? 'bg-fern border-fern'
                      : 'border-moss/50 bg-transparent'}`}
      >
        {isComplete && (
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"
            stroke="#D4DCCA" strokeWidth="3">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        )}
      </button>
    </div>
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
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        onClick={() => month > 0 && onChange(month - 1, year)}
        disabled={month === 0}
        className="w-9 h-9 bg-leaf rounded-full flex items-center
                   justify-center active:bg-moss/30 transition-colors
                   disabled:opacity-25"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
          stroke="#4A5940" strokeWidth="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      <div className="text-center">
        <h2 className="font-serif text-dark text-xl">{MONTHS[month]}</h2>
        <p className="text-xs text-subtle">{year}</p>
      </div>

      <button
        onClick={() => month < 11 && onChange(month + 1, year)}
        disabled={month === 11}
        className="w-9 h-9 bg-leaf rounded-full flex items-center
                   justify-center active:bg-moss/30 transition-colors
                   disabled:opacity-25"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
          stroke="#4A5940" strokeWidth="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Month strip ──────────────────────────────────────────────────────────────
function MonthStrip({ month, year, onChange }) {
  const activeRef = useRef(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [month])

  return (
    <div className="flex gap-1 px-4 pb-3 overflow-x-auto
                    scrollbar-none [-ms-overflow-style:none]
                    [&::-webkit-scrollbar]:hidden">
      {SHORT_MONTHS.map((m, i) => (
        <button
          key={m}
          ref={month === i ? activeRef : null}
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
  const [year]                      = useState(now.getFullYear())
  const [frostData, setFrostData]   = useState(null)
  const [location]                  = useState('Leeds')
  const [showUpgrade, setUpgrade]   = useState(false)
  const [userPlants, setUserPlants] = useState([])
  const [loading, setLoading]       = useState(true)
  const [completedKeys, setCompleted] = useState(new Set())
  const [toggling, setToggling]     = useState(null)
  const [zoneFilter, setZoneFilter] = useState('All')

  // ── Fetch user's plants with care data ────────────────────────────────────
  useEffect(() => {
    const fetchPlants = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('user_plants')
          .select('id, status, location, plants(common_name, latin_name, photo_url, care_calendar, pruning_when, pruning_how, watering, winter_care, flowering_season)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
        setUserPlants(data || [])
      } finally {
        setLoading(false)
      }
    }
    fetchPlants()
  }, [])

  // ── Fetch completions for this year ───────────────────────────────────────
  useEffect(() => {
    const fetchCompletions = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_task_completions')
        .select('user_plant_id, month, task')
        .eq('user_id', user.id)
        .eq('year', year)
      if (data) {
        setCompleted(new Set(data.map(r =>
          `${r.user_plant_id}-${r.month}-${r.task}`
        )))
      }
    }
    fetchCompletions()
  }, [year])

  // ── Pro status ────────────────────────────────────────────────────────────
  const isPro = false

  // ── Frost data (Pro only) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isPro) return
    const fetchFrost = async () => {
      try {
        let lat = 53.8008, lon = -1.5491
        if (navigator.geolocation) {
          await new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
              pos => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve() },
              () => resolve(),
              { timeout: 3000 }
            )
          })
        }
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_min&timezone=Europe%2FLondon&forecast_days=1`
        )
        const data = await res.json()
        const minTemp = Math.round(data.daily.temperature_2m_min[0])
        let frostRisk = 'none'
        if (minTemp <= 0) frostRisk = 'high'
        else if (minTemp <= 2) frostRisk = 'medium'
        else if (minTemp <= 5) frostRisk = 'low'
        const descriptions = {
          none: 'No frost risk tonight', low: 'Cool night — watch tender plants',
          medium: 'Near-freezing — consider covering dahlias',
          high: 'Frost likely — protect tender plants now',
        }
        setFrostData({ minTemp, frostRisk, description: descriptions[frostRisk] })
      } catch {
        setFrostData({ minTemp: '—', frostRisk: 'none', description: 'Weather data unavailable' })
      }
    }
    fetchFrost()
  }, [isPro])

  // ── Toggle task completion ─────────────────────────────────────────────────
  const handleToggle = async (task) => {
    const key = completionKey(task)
    if (toggling === key) return
    setToggling(key)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (completedKeys.has(key)) {
        await supabase.from('user_task_completions')
          .delete()
          .eq('user_plant_id', task.user_plant_id)
          .eq('month', task.month)
          .eq('year', year)
          .eq('task', task.action)
        setCompleted(prev => { const s = new Set(prev); s.delete(key); return s })
      } else {
        await supabase.from('user_task_completions')
          .insert({
            user_id:       user.id,
            user_plant_id: task.user_plant_id,
            month:         task.month,
            year,
            task:          task.action,
          })
        setCompleted(prev => new Set([...prev, key]))
      }
    } finally {
      setToggling(null)
    }
  }

  // ── Tasks for selected month ───────────────────────────────────────────────
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()
  const allTasks = getTasksForMonth(month, userPlants, isCurrentMonth)

  // Zone filter — derived from plants that have tasks this month
  const zones = ['All', ...new Set(allTasks.map(t => t.location).filter(Boolean))]
  const tasks = zoneFilter === 'All'
    ? allTasks
    : allTasks.filter(t => t.location === zoneFilter)

  const grouped = groupByCategory(tasks)
  const total   = tasks.length
  const done    = tasks.filter(t => completedKeys.has(completionKey(t))).length

  const handleMonthChange = (m) => { setMonth(m); setZoneFilter('All') }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />

      {loading && (
        <div className="flex flex-col gap-3 px-4 pt-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-moss/10 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          <MonthNav month={month} year={year} onChange={handleMonthChange} />
          <MonthStrip month={month} year={year} onChange={handleMonthChange} />
        </>
      )}

      {!loading && (
        <main className="flex-1 flex flex-col gap-3 px-4 pb-4">

          {/* Zone filter — only shown when plants span more than one zone */}
          {zones.length > 2 && (
            <div className="flex gap-2 overflow-x-auto pb-1
                            scrollbar-none [-ms-overflow-style:none]
                            [&::-webkit-scrollbar]:hidden">
              {zones.map(z => (
                <button
                  key={z}
                  onClick={() => setZoneFilter(z)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full
                              font-medium tracking-wide transition-colors
                              ${zoneFilter === z
                                ? 'bg-fern text-sage'
                                : 'bg-white border border-moss/40 text-subtle'}`}
                >
                  {z}
                </button>
              ))}
            </div>
          )}

          {/* Frost indicator */}
          <FrostIndicator
            frostData={frostData}
            location={location}
            isPro={isPro}
            onUpgrade={() => setUpgrade(true)}
          />

          {/* Progress summary */}
          {total > 0 && (
            <div className="flex items-center justify-between
                            bg-white border border-moss/40 rounded-xl px-4 py-3">
              <div>
                <p className="font-serif text-dark text-lg leading-none">
                  {done} <span className="text-subtle text-base">of {total}</span>
                </p>
                <p className="text-xs text-subtle mt-0.5">tasks done this month</p>
              </div>
              {/* Progress bar */}
              <div className="w-24 h-2 bg-leaf rounded-full overflow-hidden">
                <div
                  className="h-full bg-fern rounded-full transition-all duration-300"
                  style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {/* Tasks grouped by category */}
          {total === 0 ? (
            <EmptyMonth month={month} onScan={() => navigate('/scan')} />
          ) : (
            Object.entries(grouped).map(([cat, catTasks]) => (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base leading-none">{categoryIcon(cat)}</span>
                  <p className="text-xs font-medium text-dark uppercase tracking-widest">
                    {cat}
                  </p>
                  <span className="text-[10px] text-subtle ml-auto">
                    {catTasks.filter(t => completedKeys.has(completionKey(t))).length}/{catTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {catTasks.map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      isComplete={completedKeys.has(completionKey(t))}
                      onToggle={() => handleToggle(t)}
                      toggling={toggling === completionKey(t)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {/* Pro nudge */}
          {!isPro && total > 0 && (
            <button
              onClick={() => setUpgrade(true)}
              className="w-full bg-fern/5 border border-fern/20 rounded-xl
                         px-4 py-3 text-center active:bg-fern/10 transition-colors"
            >
              <p className="text-xs font-medium text-fern">
                Unlock frost alerts & full calendar with Sown Pro
              </p>
              <p className="text-xs text-subtle mt-0.5">£19.99/year</p>
            </button>
          )}

        </main>
      )}

      {showUpgrade && <UpgradeSheet onClose={() => setUpgrade(false)} />}
    </div>
  )
}

// Care calendar logic lives in src/lib/careCalendar.js (shared with Home)
