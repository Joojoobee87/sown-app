// src/screens/Scan.jsx
// Sown App — Scan & Identify screen
// Paste this file into src/screens/Scan.jsx
//
// What this does:
//   1. Opens the device camera (rear-facing by default)
//   2. "Read label" or "Identify plant" sends a frame to the identify-plant
//      edge function, which identifies it with Claude and returns the
//      catalogue profile (a draft if it's new to Sown)
//   3. Search looks in the Sown catalogue; "Look up with AI" uses the same
//      edge function by name
//   4. Shows the profile, then saves the user's plant to garden_plants
//
// The app never writes to the catalogue directly: new plants are created as
// drafts by the edge function.

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import SownIcon from '../components/SownIcon'
import {
  label, labelList, formatMonths, formatRange, botanicalName, displayName,
  verificationLabel, safetyWording, SAFETY_DISCLAIMER,
} from '../lib/catalogue'

// ─── Scan icon — corner-bracket viewfinder with a small leaf centre ──────────
function ScanIcon({ size = 20, stroke = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 8V5a2 2 0 012-2h3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 3h3a2 2 0 012 2v3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 16v3a2 2 0 01-2 2h-3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 21H5a2 2 0 01-2-2v-3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="15.5" x2="12" y2="12" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M12 12c0 0-2-1.8-2-3.5C10 7.1 10.9 6.5 12 6.5s2 .6 2 2c0 1.7-2 3.5-2 3.5z" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Search icon — magnifier with a leaf-vein inside the lens ─────────────────
function SearchIcon({ size = 16, stroke = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7.5" stroke={stroke} strokeWidth="1.8"/>
      <path d="m21 21-4.5-4.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="11" y1="14" x2="11" y2="9" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" opacity="0.65"/>
      <path d="M11 12l-1.8-1.4" stroke={stroke} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M11 10.5l1.8-1.4" stroke={stroke} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}

// ─── Scanning animation overlay ───────────────────────────────────────────────
function ScanOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Corner brackets */}
      <div className="relative w-48 h-48">
        {/* Top left */}
        <div className="absolute top-0 left-0 w-8 h-8
                        border-t-2 border-l-2 border-sage rounded-tl-sm" />
        {/* Top right */}
        <div className="absolute top-0 right-0 w-8 h-8
                        border-t-2 border-r-2 border-sage rounded-tr-sm" />
        {/* Bottom left */}
        <div className="absolute bottom-0 left-0 w-8 h-8
                        border-b-2 border-l-2 border-sage rounded-bl-sm" />
        {/* Bottom right */}
        <div className="absolute bottom-0 right-0 w-8 h-8
                        border-b-2 border-r-2 border-sage rounded-br-sm" />
        {/* Scanning line */}
        <div className="absolute left-2 right-2 h-px bg-clay/80
                        animate-scan-line" />
      </div>
    </div>
  )
}

// ─── Zone-plant RAG compatibility scoring ────────────────────────────────────
// plant: a plant_profiles_resolved row.  zone: a row from the zones table.
const TENDER = new Set(['H1a', 'H1b', 'H1c', 'H2'])   // won't survive UK frost
const HALF_HARDY = new Set(['H3'])

function scoreZoneForPlant(plant, zone) {
  const zoneHasData = zone.sun || zone.aspect || zone.soil_type || zone.soil_drainage ||
                      zone.shelter || zone.frost_pocket
  if (!zoneHasData) {
    return { rag: 'unknown', label: 'No data', reasons: [] }
  }

  const issues   = []  // red flags
  const warnings = []  // amber flags
  const positives = [] // things that look good

  const plantSun = plant.sun || []
  const tender = TENDER.has(plant.rhs_hardiness)
  const halfHardy = HALF_HARDY.has(plant.rhs_hardiness)

  // ── Sun ──
  if (plantSun.length && zone.sun) {
    if (plantSun.includes(zone.sun)) {
      positives.push('Sun conditions match well')
    } else if (zone.sun === 'full_shade' && plantSun.every(s => s === 'full_sun')) {
      issues.push('Needs full sun — this zone is shaded')
    } else if (zone.sun === 'full_sun' && plantSun.every(s => s === 'full_shade')) {
      issues.push('Needs shade — this zone gets full sun')
    } else if (zone.sun === 'partial_shade' && plantSun.includes('full_sun')) {
      warnings.push('Prefers full sun; this zone is partly shaded')
    } else if (zone.sun === 'full_shade') {
      warnings.push('Likes some sun; this zone is in full shade')
    } else {
      warnings.push(`Prefers ${labelList('sun', plantSun).toLowerCase()}`)
    }
  }

  // ── Aspect (zone faces e.g. SW; plant suits any of N/E/S/W) ──
  if (zone.aspect && plant.aspect?.length) {
    const facing = zone.aspect.split('')
    if (!facing.some(d => plant.aspect.includes(d))) {
      warnings.push(`Zone faces ${zone.aspect}; does best facing ${plant.aspect.join(' or ')}`)
    }
  }

  // ── Soil ──
  if (zone.soil_type && plant.soil_type?.length) {
    if (plant.soil_type.includes(zone.soil_type)) {
      positives.push('Soil type looks compatible')
    } else {
      warnings.push(`Prefers ${labelList('soil_type', plant.soil_type).toLowerCase()} soil; this zone is ${label('soil_type', zone.soil_type).toLowerCase()}`)
    }
  }

  // ── Drainage ──
  if (zone.soil_drainage && plant.soil_moisture) {
    if (zone.soil_drainage === 'poorly_drained' && plant.soil_moisture === 'well_drained') {
      issues.push('Poor drainage — this plant needs free-draining soil')
    } else if (zone.soil_drainage === 'well_drained' && plant.soil_moisture === 'poorly_drained') {
      warnings.push('Likes wet soil; this zone drains freely')
    }
  }

  // ── Frost pocket ──
  if (zone.frost_pocket) {
    if (tender) issues.push('Tender plant — a frost pocket risks winter losses')
    else if (halfHardy) warnings.push('Half-hardy — give it winter protection in this frost pocket')
  }

  // ── Shelter ──
  if (zone.shelter === 'exposed') {
    if (tender || halfHardy) {
      warnings.push('Exposed site — consider shelter for this tender plant')
    } else if (plant.exposure?.length && !plant.exposure.includes('exposed')) {
      warnings.push('Prefers a sheltered spot; this zone is exposed')
    }
  }

  // ── Determine RAG from issues/warnings ──
  let rag
  if (issues.length > 0)   rag = 'red'
  else if (warnings.length > 0) rag = 'amber'
  else                           rag = 'green'

  const ragLabel = rag === 'green' ? 'Good match'
                 : rag === 'amber' ? 'Some concerns'
                 : 'Poor match'

  const topReason = issues[0] || warnings[0] || positives[0] || null

  return { rag, label: ragLabel, topReason, issues, warnings, positives }
}

// ─── Plant profile card (shown after identification) ──────────────────────────
// result: { profile, careTasks, identification, status, addedVia }
//   profile: a plant_profiles_resolved row (variety fields filled from species)
const MATCH_LABEL = { high: 'good match', medium: 'likely match', low: 'possible match' }

function CardSection({ title, children, accent }) {
  return (
    <div className={`bg-white border border-moss/40 rounded-xl px-4 py-3
                     ${accent ? 'border-l-2 border-l-fern' : ''}`}>
      <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">{title}</p>
      {children}
    </div>
  )
}

function PlantProfileCard({ result, onSave, onDismiss, saving }) {
  const { profile, careTasks = [], identification, status } = result
  const isWishlist = status === 'want_to_grow'
  const verified = profile.status === 'verified'
  const safety = safetyWording(profile)

  const matchLabel = !identification ? null
    : identification.source === 'label' ? 'label read'
    : MATCH_LABEL[identification.confidence] || null

  const facts = [
    { label: 'Sun',       value: labelList('sun', profile.sun) },
    { label: 'Soil',      value: labelList('soil_type', profile.soil_type) || label('soil_moisture', profile.soil_moisture) },
    { label: 'Aspect',    value: profile.aspect?.length ? profile.aspect.join(', ') : null },
    { label: 'Height',    value: formatRange(profile.height_cm_min, profile.height_cm_max) },
    { label: 'Flowers',   value: formatMonths(profile.flowering_months) },
    { label: 'Hardiness', value: profile.rhs_hardiness ? `RHS ${profile.rhs_hardiness}` : null },
  ].filter(f => f.value)

  const careGuide = [
    ['Planting', profile.care_planting],
    ['Ongoing care', profile.care_ongoing],
    ['Through the year', profile.care_through_year],
  ].filter(([, text]) => text)

  const jobs = [...careTasks].sort((a, b) => Math.min(...a.months) - Math.min(...b.months))

  // Swipe-down-to-close on handle only
  const touchStartY = useRef(null)
  const [dragY, setDragY] = useState(0)
  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY }
  const handleTouchMove  = (e) => {
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setDragY(dy)
  }
  const handleTouchEnd = () => {
    if (dragY > 60) { onDismiss(); return }
    setDragY(0)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-dark/50 z-40" onClick={onDismiss} />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                   bg-parchment rounded-t-2xl z-50 max-h-[85vh]
                   overflow-y-auto overflow-x-hidden w-full"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY > 0 ? 'none' : 'transform 0.25s ease',
        }}
      >

        {/* Handle — tap or swipe down to dismiss */}
        <div
          className="flex justify-center pt-3 pb-2 sticky top-0
                     bg-parchment z-10 cursor-pointer"
          onClick={onDismiss}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-moss rounded-full" />
        </div>

        {/* Header — Sown leaf until catalogue photos are added */}
        <div className="mx-3 bg-fern rounded-xl p-4 mb-3 flex items-center gap-3">
          <div className="w-12 h-12 bg-dark/30 rounded-lg flex items-center
                          justify-center flex-shrink-0">
            <SownIcon size={28} fill="#D4DCCA" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-sage text-base leading-tight">
              {displayName(profile)}
            </p>
            <p className="text-xs text-moss italic mt-0.5">{botanicalName(profile)}</p>
          </div>
          {matchLabel && (
            <div className="bg-dark/20 text-sage text-[10px] px-2 py-1 rounded-full flex-shrink-0">
              {matchLabel}
            </div>
          )}
        </div>

        <div className="px-4 pb-24 flex flex-col gap-3">

          {/* Verified or not */}
          <div className="flex items-start gap-2">
            <span
              data-testid="verification-badge"
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0
                          ${verified ? 'bg-fern text-sage' : 'bg-white text-clay border border-clay/40'}`}
            >
              {verificationLabel(profile)}
            </span>
            {!verified && (
              <p className="text-xs text-subtle leading-snug pt-0.5">
                Drafted with AI and not yet checked by Sown. Use it as a starting point.
              </p>
            )}
          </div>

          {profile.summary && (
            <p className="text-sm text-muted leading-relaxed">{profile.summary}</p>
          )}

          {/* Key facts grid */}
          {facts.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {facts.map(({ label: name, value }) => (
                <div key={name} className="bg-leaf rounded-lg px-3 py-2">
                  <p className="text-[10px] text-subtle uppercase tracking-widest mb-0.5">
                    {name}
                  </p>
                  <p className="text-sm text-dark font-medium">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Watering: the care label, not a reminder */}
          {(profile.water_need || profile.water_notes) && (
            <CardSection title="Watering">
              {profile.water_need && (
                <p className="text-sm text-dark font-medium">
                  Water need: {label('water_need', profile.water_need)}
                </p>
              )}
              {profile.water_notes && (
                <p className="text-sm text-muted leading-relaxed mt-0.5">{profile.water_notes}</p>
              )}
            </CardSection>
          )}

          {/* Care guide */}
          {careGuide.map(([title, text]) => (
            <CardSection key={title} title={title}>
              <p className="text-sm text-muted leading-relaxed">{text}</p>
            </CardSection>
          ))}

          {/* Jobs through the year */}
          {jobs.length > 0 && (
            <CardSection title="Jobs through the year" accent>
              <ul className="flex flex-col gap-2 mt-1">
                {jobs.map(t => (
                  <li key={t.id} className="text-sm leading-relaxed">
                    <span className="font-medium text-dark">{label('task_type', t.task_type)}</span>
                    <span className="text-subtle"> · {formatMonths(t.months)}</span>
                    {t.repeat === 'ongoing' && (
                      <span className="text-subtle text-xs"> · reminder</span>
                    )}
                    {t.task_trigger === 'after_last_frost' && (
                      <span className="text-subtle text-xs"> · after the last frost</span>
                    )}
                    <p className="text-muted">{t.instructions}</p>
                  </li>
                ))}
              </ul>
            </CardSection>
          )}

          {/* Common problems */}
          {profile.common_problems?.length > 0 && (
            <CardSection title="Common problems">
              <ul className="flex flex-col gap-1.5 mt-1">
                {profile.common_problems.map((p, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    <span className="font-medium text-dark">{p.problem}: </span>
                    <span className="text-muted">{p.what_to_do}</span>
                  </li>
                ))}
              </ul>
            </CardSection>
          )}

          {/* Beginner tips */}
          {profile.beginner_tips?.length > 0 && (
            <CardSection title="Tips">
              <ul className="list-disc pl-4 flex flex-col gap-1 mt-1">
                {profile.beginner_tips.map((tip, i) => (
                  <li key={i} className="text-sm text-muted leading-relaxed">{tip}</li>
                ))}
              </ul>
            </CardSection>
          )}

          {profile.good_for_pollinators === 'yes' && (
            <p className="text-sm text-fern font-medium px-1">Good for pollinators</p>
          )}

          {/* Safety: HTA list only, never a "safe" badge */}
          <div
            data-testid="safety"
            className={`rounded-xl px-4 py-3 border
                        ${safety.tone === 'harmful' ? 'bg-clay/10 border-clay/40' : 'bg-white border-moss/40'}`}
          >
            <p className={`text-xs font-medium mb-1 tracking-wide uppercase
                           ${safety.tone === 'harmful' ? 'text-clay' : 'text-fern'}`}>
              Safety
            </p>
            {safety.lines.map((line, i) => (
              <p key={i} className="text-sm text-muted leading-relaxed">{line}</p>
            ))}
            <p className="text-[11px] text-subtle leading-relaxed mt-2">{SAFETY_DISCLAIMER}</p>
          </div>

          {/* Context label for wishlist results */}
          {isWishlist && (
            <p className="text-xs text-subtle text-center leading-relaxed px-2">
              This will be saved to your wishlist. Update to "Growing" once you have it in the garden.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-1">
            <button
              onClick={onDismiss}
              className="flex-1 bg-leaf text-fern text-sm font-medium
                         py-3 rounded-xl tracking-wide
                         active:opacity-70 transition-opacity"
            >
              Dismiss
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 bg-fern text-sage text-sm font-medium
                         py-3 rounded-xl tracking-wide
                         active:opacity-70 transition-opacity
                         disabled:opacity-50"
            >
              {saving ? 'Saving...' : isWishlist ? 'Add to wishlist' : 'Save to my garden'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── Recent scan pill ─────────────────────────────────────────────────────────
function RecentPill({ name, latinName, daysAgo, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-moss/40 rounded-xl
                 px-4 py-3 flex justify-between items-center text-left
                 active:bg-leaf transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm text-dark truncate">{name}</p>
        {latinName && (
          <p className="text-xs text-subtle italic truncate mt-0.5">
            {latinName}
          </p>
        )}
      </div>
      <span className="text-xs text-subtle ml-3 flex-shrink-0">
        {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
      </span>
    </button>
  )
}

// ─── Main Scan screen ─────────────────────────────────────────────────────────
export default function Scan() {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const [scanType, setScanType]   = useState('label')    // 'label' | 'identify'
  const [cameraReady, setCamReady] = useState(false)
  const [cameraError, setCamError] = useState(null)
  const [cameraGranted, setCameraGranted] = useState(
    () => !!localStorage.getItem('sown_camera_granted')
  )
  const [scanning, setScanning]   = useState(false)
  const [search, setSearch]       = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  // { profile, careTasks, identification, status: 'growing' | 'want_to_grow', addedVia }
  const [result, setResult]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [toast, setToast]         = useState(null)
  const [lookingUp, setLookingUp] = useState(false)

  // ── Zone picker ────────────────────────────────────────────────────────────
  const [showZonePicker, setShowZonePicker] = useState(false)
  const [zones, setZones]                   = useState([])
  const [zonesLoading, setZonesLoading]     = useState(false)
  const [newZoneName, setNewZoneName]       = useState('')
  const [addingZone, setAddingZone]         = useState(false)

  // ── Lock body scroll when a modal sheet is open ────────────────────────────
  useEffect(() => {
    if (result || showZonePicker) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [result, showZonePicker])

  // ── Recently saved plants ──────────────────────────────────────────────────
  const [recentScans, setRecentScans] = useState([])

  useEffect(() => {
    const fetchRecent = async () => {
      const { data: rows } = await supabase
        .from('garden_plants')
        .select('id, plant_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      if (!rows?.length) { setRecentScans([]); return }
      const { data: profiles } = await supabase
        .from('plant_profiles_resolved')
        .select('id, genus, species, cultivar, common_names')
        .in('id', [...new Set(rows.map(r => r.plant_id))])
      const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      setRecentScans(rows.map(row => ({
        id: row.id,
        common_name: displayName(byId[row.plant_id]),
        latin_name: botanicalName(byId[row.plant_id]),
        daysAgo: Math.floor((Date.now() - new Date(row.created_at)) / 86400000),
      })))
    }
    fetchRecent()
  }, [savedCount])

  // ── Start camera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCamReady(true)
      }
      localStorage.setItem('sown_camera_granted', '1')
      setCameraGranted(true)
    } catch (err) {
      // Common errors: NotAllowedError (permission denied), NotFoundError (no camera)
      if (err.name === 'NotAllowedError') {
        localStorage.removeItem('sown_camera_granted')
        setCameraGranted(false)
        setCamError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setCamError('No camera found on this device.')
      } else {
        setCamError('Could not start camera. Try the search option below.')
      }
    }
  }, [])

  // ── Stop camera ────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCamReady(false)
  }, [])

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (cameraGranted) startCamera()
    return () => stopCamera()
  }, [cameraGranted, startCamera, stopCamera])

  // ── Capture frame & identify ───────────────────────────────────────────────
  const handleIdentify = async () => {
    if (!videoRef.current || !canvasRef.current || scanning) return
    setScanning(true)

    // Draw current video frame to canvas
    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    // Convert to base64
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]

    try {
      const found = await callIdentifyPlant({ image: base64, mode: scanType })
      setResult({
        profile: found.profile,
        careTasks: found.care_tasks,
        identification: found.identification,
        status: 'growing',
        addedVia: scanType === 'label' ? 'label_scan' : 'photo_id',
      })
    } catch (err) {
      showToast(err.message || 'Could not identify plant — try again or search by name')
    } finally {
      setScanning(false)
    }
  }

  // ── AI name lookup — calls Edge Function with plant name ──────────────────
  const handleNameLookup = async (plantName) => {
    if (lookingUp) return
    setLookingUp(true)
    try {
      const found = await callIdentifyPlant({ name: plantName })
      setResult({
        profile: found.profile,
        careTasks: found.care_tasks,
        identification: found.identification,
        status: 'want_to_grow',
        addedVia: 'search',
      })
    } catch (err) {
      console.error('[Sown] name lookup failed:', err)
      showToast(err.message || 'Could not look up that plant — please try again')
    } finally {
      setLookingUp(false)
    }
  }

  // ── Search the Sown catalogue ──────────────────────────────────────────────
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data, error } = await supabase.rpc('search_plant_profiles', {
          p_query: search.trim(), p_limit: 8,
        })
        if (error) console.error('[Sown] search failed:', error)
        setSearchResults(data || [])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // ── Open a catalogue search result ─────────────────────────────────────────
  const handleOpenSearchResult = async (profile) => {
    const { data: tasks } = await supabase
      .from('plant_care_tasks_resolved')
      .select('*')
      .eq('for_plant_id', profile.id)
    setResult({
      profile,
      careTasks: tasks || [],
      identification: null,
      status: 'growing',
      addedVia: 'search',
    })
  }

  // ── Fetch user's garden zones (with all condition fields for RAG matching) ──
  const fetchZones = async () => {
    setZonesLoading(true)
    try {
      const { data } = await supabase
        .from('zones')
        .select('id, name, aspect, sun, soil_type, soil_drainage, shelter, frost_pocket')
        .order('created_at', { ascending: true })
      setZones(data || [])
    } finally {
      setZonesLoading(false)
    }
  }

  const handleOpenZonePicker = async () => {
    await fetchZones()
    setNewZoneName('')
    setShowZonePicker(true)
  }

  // ── Save the user's plant ──────────────────────────────────────────────────
  // zone: a row from zones, or null. The catalogue profile already exists
  // (found by search, or created as a draft by the edge function).
  const handleSave = async (zone) => {
    if (!result || saving) return
    setSaving(true)
    setShowZonePicker(false)
    try {
      const { error } = await supabase
        .from('garden_plants')
        .insert({
          plant_id:  result.profile.id,
          zone_id:   zone?.id ?? null,
          status:    result.status,
          added_via: result.addedVia,
        })
      if (error) throw error

      setSavedCount(n => n + 1)
      setResult(null)
      showToast(result.status === 'want_to_grow' ? 'Added to your wishlist ✓' : 'Saved to your garden ✓')
    } catch (err) {
      console.error('[Sown] Save failed:', err)
      showToast('Could not save — please try again')
    } finally {
      setSaving(false)
    }
  }

  // ── Create a new zone then save ────────────────────────────────────────────
  const handleCreateZoneAndSave = async () => {
    const name = newZoneName.trim()
    if (!name) return
    setAddingZone(true)
    try {
      const { data: zone, error } = await supabase
        .from('zones')
        .insert({ name })
        .select()
        .single()
      if (error) {
        if (error.code === '23505') {
          showToast(`You already have a zone called "${name}"`)
          return
        }
        throw error
      }
      await handleSave(zone)
    } catch {
      showToast('Could not create zone — please try again')
    } finally {
      setAddingZone(false)
    }
  }

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-dark pb-20">

      <TopBar />

      {/* Scan type toggle */}
      <div className="flex mx-4 mt-4 mb-3 bg-dark/60 rounded-xl p-1 gap-1">
        <button
          onClick={() => setScanType('label')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium tracking-wide
                      transition-colors flex items-center justify-center gap-2
                      ${scanType === 'label' ? 'bg-fern text-sage' : 'text-subtle'}`}
        >
          <ScanIcon size={17} stroke="currentColor" />
          Scan label
        </button>
        <button
          onClick={() => setScanType('identify')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium tracking-wide
                      transition-colors flex items-center justify-center gap-2
                      ${scanType === 'identify' ? 'bg-fern text-sage' : 'text-subtle'}`}
        >
          <SearchIcon size={16} stroke="currentColor" />
          Identify plant
        </button>
      </div>

      {/* ── Camera + search ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4">

          {/* Viewfinder */}
          <div className="relative bg-dark rounded-2xl overflow-hidden"
               style={{ aspectRatio: '4/3' }}>

            {/* Video element */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Scan overlay (corner brackets + animated line) */}
            {cameraReady && !scanning && <ScanOverlay />}

            {/* First-visit prompt — user must tap to trigger permission */}
            {!cameraReady && !cameraError && !cameraGranted && (
              <div className="absolute inset-0 flex flex-col items-center
                              justify-center gap-4 px-6 text-center">
                <SownIcon size={40} fill="#D4DCCA" />
                <p className="text-sage/80 text-sm leading-relaxed">
                  Sown needs camera access to identify your plants
                </p>
                <button
                  onClick={startCamera}
                  className="bg-fern text-sage text-sm font-medium
                             px-6 py-3 rounded-xl tracking-wide
                             active:opacity-80 transition-opacity"
                >
                  Allow camera
                </button>
              </div>
            )}

            {/* Loading state — after permission granted */}
            {!cameraReady && !cameraError && cameraGranted && (
              <div className="absolute inset-0 flex flex-col items-center
                              justify-center gap-3">
                <div className="w-8 h-8 border-2 border-sage/30
                                border-t-sage rounded-full animate-spin" />
                <p className="text-sage/60 text-sm">Starting camera...</p>
              </div>
            )}

            {/* Scanning state */}
            {scanning && (
              <div className="absolute inset-0 bg-dark/60 flex flex-col
                              items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-moss/30
                                border-t-moss rounded-full animate-spin" />
                <p className="text-moss text-sm">
                  {scanType === 'label' ? 'Reading label...' : 'Identifying plant...'}
                </p>
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center
                              justify-center gap-3 px-6 text-center">
                <p className="text-sage/80 text-sm leading-relaxed">
                  {cameraError}
                </p>
                <p className="text-sage/60 text-xs">
                  Try the search below instead
                </p>
              </div>
            )}

            {/* Instruction label */}
            {cameraReady && !scanning && (
              <div className="absolute bottom-4 left-0 right-0
                              text-center">
                <p className="text-sage/70 text-xs tracking-wide">
                  {scanType === 'label'
                    ? 'Point at a plant label or tag'
                    : 'Point at the plant itself'}
                </p>
              </div>
            )}

          </div>

          {/* Identify / Read button */}
          <button
            onClick={handleIdentify}
            disabled={!cameraReady || scanning}
            className="w-full bg-fern text-sage font-medium text-base
                       py-4 rounded-2xl tracking-wide
                       disabled:opacity-40 active:opacity-80
                       transition-opacity"
          >
            {scanning
              ? (scanType === 'label' ? 'Reading label...' : 'Identifying...')
              : (scanType === 'label' ? 'Read label' : 'Identify plant')}
          </button>

          {/* Tips */}
          <div className="bg-dark/50 border border-subtle/20 rounded-xl p-4">
            <p className="text-sage/60 text-[10px] uppercase tracking-widest font-medium mb-3">
              {scanType === 'label' ? 'Label scanning tips' : 'Plant identification tips'}
            </p>
            {scanType === 'label' ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-3 items-start">
                  <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sage/70 text-xs leading-relaxed">
                    <span className="text-sage/90 font-medium">Fill the frame with the label.</span>{' '}
                    Get close enough that the text is legible — garden centre tags often have small print.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sage/70 text-xs leading-relaxed">
                    <span className="text-sage/90 font-medium">Avoid glare.</span>{' '}
                    Tilt the label slightly if sunlight is reflecting off the surface.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sage/70 text-xs leading-relaxed">
                    <span className="text-sage/90 font-medium">No label?</span>{' '}
                    Switch to Identify plant mode and point at the plant itself.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-3 items-start">
                  <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sage/70 text-xs leading-relaxed">
                    <span className="text-sage/90 font-medium">Show leaves and flowers.</span>{' '}
                    Capture the most distinctive parts of the plant — ideally both foliage and any blooms.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sage/70 text-xs leading-relaxed">
                    <span className="text-sage/90 font-medium">Good light matters.</span>{' '}
                    Natural daylight gives the best colour accuracy for identification.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-sage/70 text-xs leading-relaxed">
                    <span className="text-sage/90 font-medium">Visual ID is harder than label reading.</span>{' '}
                    If you're not confident in the result, try searching by name below.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Search by name (always visible below camera) ──────────── */}
          <div className="border-t border-subtle/20 pt-4">
            <p className="text-sage/50 text-[10px] uppercase tracking-widest font-medium mb-3">
              Or search by name
            </p>
            <div className="flex flex-col gap-3">

          {/* Search input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <SearchIcon size={16} stroke="#8A7E6E" />
            </span>
            <input
              autoFocus
              type="text"
              placeholder="Type a plant name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-dark/60 border border-subtle/30
                         rounded-xl pl-9 pr-4 py-3 text-base text-sage
                         placeholder:text-subtle/60
                         focus:outline-none focus:border-moss
                         transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-subtle"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Search results */}
          {searching && (
            <p className="text-subtle text-sm text-center py-4">
              Searching...
            </p>
          )}

          {/* Local DB results */}
          {searchResults.map(profile => (
            <button
              key={profile.id}
              onClick={() => handleOpenSearchResult(profile)}
              className="w-full bg-dark/60 border border-subtle/30
                         rounded-xl px-4 py-3 text-left
                         active:border-moss transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-sage">{displayName(profile)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0
                                  ${profile.status === 'verified'
                                    ? 'bg-fern text-sage'
                                    : 'border border-subtle/40 text-subtle'}`}>
                  {verificationLabel(profile)}
                </span>
              </div>
              {profile.common_names?.length > 0 && (
                <p className="text-xs text-subtle italic mt-0.5">
                  {botanicalName(profile)}
                </p>
              )}
            </button>
          ))}

          {/* AI lookup — shown whenever the user has typed something */}
          {search.trim().length > 2 && !searching && (
            <div className="mt-1">
              {searchResults.length === 0 && (
                <p className="text-subtle text-xs text-center mb-3">
                  Not in the Sown catalogue yet
                </p>
              )}
              <button
                onClick={() => handleNameLookup(search.trim())}
                disabled={lookingUp}
                className="w-full bg-fern/20 border border-fern/40
                           rounded-xl px-4 py-3.5 text-left
                           active:bg-fern/30 transition-colors
                           disabled:opacity-50 flex items-center gap-3"
              >
                <div className="flex-shrink-0">
                  {lookingUp
                    ? <div className="w-5 h-5 border-2 border-moss/30 border-t-moss rounded-full animate-spin" />
                    : <SownIcon size={20} fill="#D4DCCA" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-sage font-medium">
                    {lookingUp ? 'Looking up…' : `Look up "${search.trim()}" with AI`}
                  </p>
                  <p className="text-xs text-moss/80 mt-0.5">
                    Get care info and buying advice
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Recent scans section */}
          {!search && recentScans.length > 0 && (
            <>
              <p className="text-xs text-subtle uppercase tracking-widest mt-2">
                Recent scans
              </p>
              {recentScans.map(s => (
                <RecentPill
                  key={s.id}
                  name={s.common_name}
                  latinName={s.latin_name}
                  daysAgo={s.daysAgo}
                  onClick={() => {
                    showToast('Tap to view full profile — fetch from Supabase here')
                  }}
                />
              ))}
            </>
          )}

            </div>{/* end search inner flex-col */}
          </div>{/* end search border-t section */}

        </div>{/* end camera+search outer flex-col */}

      {/* Plant profile result sheet */}
      {result && (
        <PlantProfileCard
          result={result}
          onSave={result.status === 'want_to_grow'
            ? () => handleSave(null)   // wishlist — no zone needed
            : handleOpenZonePicker}
          onDismiss={() => setResult(null)}
          saving={saving}
        />
      )}

      {/* Zone picker sheet */}
      {showZonePicker && (
        <>
          <div
            className="fixed inset-0 bg-dark/50 z-[60]"
            onClick={() => setShowZonePicker(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                          bg-parchment rounded-t-2xl z-[70] pb-safe
                          overflow-x-hidden w-full">

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-moss rounded-full" />
            </div>

            <div className="px-4 pb-8 pt-2">
              <h2 className="font-serif text-dark text-lg mb-1">
                Choose a garden zone
              </h2>
              <p className="text-sm text-subtle mb-4">
                Where will this plant live?
              </p>

              {zonesLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-moss/30
                                  border-t-moss rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-4">
                  {(() => {
                    const plant = result?.profile
                    const scored = zones.map(zone => ({
                      zone,
                      score: plant ? scoreZoneForPlant(plant, zone) : { rag: 'unknown', label: '', topReason: null },
                    }))
                    const ragOrder = { green: 0, amber: 1, unknown: 2, red: 3 }
                    scored.sort((a, b) => ragOrder[a.score.rag] - ragOrder[b.score.rag])

                    if (scored.length === 0) {
                      return (
                        <p className="text-sm text-subtle text-center py-3">
                          No zones yet — create your first one below
                        </p>
                      )
                    }

                    const allUnknown = scored.length > 0 && scored.every(s => s.score.rag === 'unknown')

                    return [
                      ...scored.map(({ zone, score }) => {
                      const dotStyle = score.rag === 'green'   ? { background: '#5a7a4a' }
                                     : score.rag === 'amber'   ? { background: '#b07d3a' }
                                     : score.rag === 'red'     ? { background: '#9e4a3a' }
                                     : { background: '#BFCAAD', opacity: 0.6 }
                      const badgeStyle = score.rag === 'green'
                        ? { color: '#3d5c2e', background: '#eef2e8', border: '1px solid #c5d4b5' }
                        : score.rag === 'amber'
                        ? { color: '#7a5520', background: '#f7eed8', border: '1px solid #dfc090' }
                        : score.rag === 'red'
                        ? { color: '#7a3020', background: '#f5e8e5', border: '1px solid #d4a090' }
                        : { color: '#8A7E6E', background: '#f5f4f2', border: '1px solid #d6d0c8' }
                      const badgeLabel = score.rag === 'unknown' ? 'No zone data' : score.label

                      return (
                        <button
                          key={zone.id}
                          onClick={() => handleSave(zone)}
                          disabled={saving}
                          className="w-full bg-white border border-moss/40
                                     rounded-xl px-4 py-3 text-left
                                     active:bg-leaf transition-colors
                                     disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={dotStyle} />
                              <span className="text-sm text-dark font-medium truncate">{zone.name}</span>
                            </div>
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={badgeStyle}
                            >
                              {badgeLabel}
                            </span>
                          </div>
                          {score.topReason && (
                            <p className="text-xs text-subtle mt-1 pl-[18px] leading-snug">
                              {score.topReason}
                            </p>
                          )}
                        </button>
                      )
                    }),
                    allUnknown && (
                      <p key="__hint" className="text-xs text-subtle text-center pt-1 pb-2 leading-relaxed">
                        Add conditions to your zones in Garden Zones to see compatibility ratings.
                      </p>
                    ),
                  ]
                  })()}
                </div>
              )}

              {/* New zone input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New zone name…"
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateZoneAndSave()}
                  className="flex-1 bg-white border border-moss/40 rounded-xl
                             px-3 py-2.5 text-sm text-dark
                             placeholder:text-subtle/60
                             focus:outline-none focus:border-fern
                             transition-colors"
                />
                <button
                  onClick={handleCreateZoneAndSave}
                  disabled={!newZoneName.trim() || addingZone || saving}
                  className="bg-fern text-sage text-sm font-medium
                             px-4 py-2.5 rounded-xl
                             disabled:opacity-40
                             active:opacity-80 transition-opacity"
                >
                  {addingZone ? '...' : 'Add'}
                </button>
              </div>

              {/* Skip option */}
              <button
                onClick={() => handleSave(null)}
                disabled={saving}
                className="w-full text-center text-sm text-subtle mt-4
                           underline underline-offset-2 disabled:opacity-40"
              >
                Save without a zone
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-20 left-4 right-4 max-w-md mx-auto
                        bg-fern text-sage text-sm font-medium
                        px-4 py-3 rounded-xl z-50 text-center
                        shadow-lg transition-all">
          {toast}
        </div>
      )}

    </div>
  )
}

// ─── Claude via the identify-plant edge function ─────────────────────────────
// supabase.functions.invoke sends the signed-in user's token, which the
// function needs to check the daily limit and create drafts as that user.
// body: { image, mode: 'label' | 'identify' } or { name }
// Returns { profile, care_tasks, identification, usage }.
async function callIdentifyPlant(body) {
  const { data, error } = await supabase.functions.invoke('identify-plant', { body })
  if (error) {
    // The function's own message (e.g. the daily limit) is in the response body
    const details = await error.context?.json?.().catch(() => null)
    throw new Error(details?.error || 'Could not identify plant — try again or search by name')
  }
  if (!data?.profile) throw new Error('Could not identify plant — try again or search by name')
  return data
}
