// src/screens/Scan.jsx
// Sown App — Scan & Identify screen
// Paste this file into src/screens/Scan.jsx
//
// What this does:
//   1. Opens the device camera (rear-facing by default)
//   2. User taps "Identify" to capture a frame
//   3. Sends image to Plant.id API for identification
//   4. Shows the plant profile result
//   5. User can save to their Sown library (Supabase)
//   6. Manual name search as fallback
//
// Before this works you need:
//   VITE_PLANTID_KEY=your_key_here   ← add to your .env file
//   Get a free key at: plant.id

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import SownIcon from '../components/SownIcon'

// ─── Wikipedia photo lookup (client-side for reliable external access) ────────
async function fetchWikipediaPhoto(latinName) {
  if (!latinName) return null
  const lookup = async (name) => {
    try {
      const slug = name.trim().replace(/ /g, '_')
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`
      )
      if (!res.ok) return null
      const data = await res.json()
      return data?.thumbnail?.source ?? null
    } catch { return null }
  }
  return (await lookup(latinName)) ?? (await lookup(latinName.split(' ')[0]))
}

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
const SUNNY_ASPECTS   = new Set(['S','SE','SW'])
const SHADY_ASPECTS   = new Set(['N','NE','NW'])

function scoreZoneForPlant(plant, zone) {
  if (!zone.aspect && !zone.sun_exposure && !zone.soil_type) {
    return { rag: 'unknown', label: 'No data', reasons: [] }
  }

  const issues   = []  // red flags
  const warnings = []  // amber flags
  const positives = [] // things that look good

  const plantSun  = (plant.sun_requirements || '').toLowerCase()
  const zoneSun   = (zone.sun_exposure     || '').toLowerCase()
  const plantSoil = (plant.soil_type        || '').toLowerCase()
  const zoneSoil  = (zone.soil_type         || '').toLowerCase()
  const zoneAspect = (zone.aspect           || '').toUpperCase()
  const plantAspect = (plant.aspect         || '').toLowerCase()
  const plantFrost  = (plant.frost_hardiness|| '').toLowerCase()
  const zoneDrain  = (zone.soil_drainage    || '').toLowerCase()

  // ── Sun matching ──
  if (plantSun && zoneSun) {
    const needsFullSun  = plantSun.includes('full sun') && !plantSun.includes('partial')
    const needsShade    = plantSun.includes('full shade')
    const toleratesPartial = plantSun.includes('partial')
    const zoneIsShady   = zoneSun.includes('full shade')
    const zoneIsSunny   = zoneSun.includes('full sun') && !zoneSun.includes('partial')
    const zoneIsPartial = zoneSun.includes('partial')

    if (needsFullSun && zoneIsShady) {
      issues.push('Needs full sun — this zone is shaded')
    } else if (needsFullSun && zoneIsPartial) {
      warnings.push('Prefers full sun; this zone is partially shaded')
    } else if (needsShade && zoneIsSunny) {
      issues.push('Needs shade — this zone gets full sun')
    } else if (toleratesPartial && !zoneIsShady) {
      positives.push('Sun conditions look suitable')
    } else {
      positives.push('Sun conditions match well')
    }
  }

  // ── Aspect matching (plant aspect hint vs zone facing) ──
  if (zoneAspect && plantAspect && plantAspect !== 'any') {
    const zoneFacingSunny = SUNNY_ASPECTS.has(zoneAspect)
    const zoneFacingShady = SHADY_ASPECTS.has(zoneAspect)
    const plantNeedsSun   = plantAspect.includes('s') && !plantAspect.includes('n')
    const plantNeedsShade = plantAspect.includes('n') && !plantAspect.includes('s')

    if (plantNeedsSun && zoneFacingShady) {
      warnings.push(`Zone faces ${zoneAspect} — plant prefers a sunnier spot`)
    } else if (plantNeedsShade && zoneFacingSunny) {
      warnings.push(`Zone faces ${zoneAspect} — plant may prefer a shadier aspect`)
    }
  }

  // ── Soil matching ──
  if (plantSoil && zoneSoil) {
    const plantNeedsDrained = plantSoil.includes('well drained') || plantSoil.includes('sandy')
    const plantNeedsMoist   = plantSoil.includes('moist')
    const zoneIsClay        = zoneSoil.includes('clay')
    const zoneIsSandy       = zoneSoil.includes('sandy')
    const zoneIsMoist       = zoneSoil.includes('moist') || zoneIsClay

    if (plantNeedsDrained && zoneIsClay) {
      warnings.push('Plant prefers free-draining soil; clay may need improving')
    } else if (plantNeedsMoist && zoneIsSandy) {
      warnings.push('Plant likes moisture-retentive soil; sandy soil may dry out')
    } else {
      positives.push('Soil type looks compatible')
    }
  }

  // ── Drainage matching ──
  if (zoneDrain && plantSoil) {
    const poorlyDrained = zoneDrain.includes('poorly')
    const plantHatesSoggy = plantSoil.includes('well drained') || plantSoil.includes('sandy')
    if (poorlyDrained && plantHatesSoggy) {
      issues.push('Poor drainage — this plant needs free-draining conditions')
    }
  }

  // ── Frost / hardiness matching ──
  if (plantFrost && zone.frost_pocket) {
    const isTender   = plantFrost.includes('tender') || plantFrost.includes('half hardy')
    const isHalfHardy = plantFrost.includes('half hardy')
    if (isTender) {
      issues.push('Tender plant — frost pocket increases risk of winter losses')
    } else if (isHalfHardy) {
      warnings.push('Half-hardy — frost pocket may need extra winter protection')
    }
  }

  // ── Shelter matching ──
  if (zone.shelter && plantFrost) {
    const isExposed  = (zone.shelter || '').toLowerCase().includes('exposed')
    const isTender   = plantFrost.includes('tender') || plantFrost.includes('half hardy')
    if (isExposed && isTender) {
      warnings.push('Exposed site — consider shelter for this tender plant')
    }
  }

  // ── Determine RAG from issues/warnings ──
  let rag
  if (issues.length > 0)   rag = 'red'
  else if (warnings.length > 0) rag = 'amber'
  else                           rag = 'green'

  const label = rag === 'green' ? 'Good match'
              : rag === 'amber' ? 'Some concerns'
              : 'Poor match'

  const topReason = issues[0] || warnings[0] || positives[0] || null

  return { rag, label, topReason, issues, warnings, positives }
}

// ─── Plant profile card (shown after identification) ──────────────────────────
function PlantProfileCard({ result, onSave, onDismiss, saving }) {
  const { plant, probability, addedAs } = result
  const isResearch = addedAs === 'want to grow'

  const facts = [
    { label: 'Sun',      value: plant.sun_requirements },
    { label: 'Soil',     value: plant.soil_type },
    { label: 'Aspect',   value: plant.aspect },
    { label: 'Height',   value: plant.height },
    { label: 'Season',   value: plant.flowering_season },
    { label: 'Frost',    value: plant.frost_hardiness },
  ].filter(f => f.value)

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

        {/* Header */}
        {plant.photo_url ? (
          <div className="mx-3 mb-4 rounded-xl overflow-hidden relative">
            <img
              src={plant.photo_url}
              alt={plant.common_name}
              className="w-full h-36 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />
            <div className="absolute top-2 right-2">
              <div className="bg-dark/50 text-sage text-[10px] px-2 py-1 rounded-full">
                {plant.source === 'label' ? 'label read' : `${Math.round(probability * 100)}% match`}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
              <p className="font-serif text-sage text-base leading-tight">{plant.common_name}</p>
              <p className="text-xs text-sage/70 italic mt-0.5">{plant.latin_name}</p>
            </div>
          </div>
        ) : (
          <div className="mx-3 bg-fern rounded-xl p-4 mb-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-dark/30 rounded-lg flex items-center
                            justify-center flex-shrink-0">
              <SownIcon size={28} fill="#D4DCCA" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-serif text-sage text-base leading-tight">
                {plant.common_name}
              </p>
              <p className="text-xs text-moss italic mt-0.5">{plant.latin_name}</p>
            </div>
            <div className="bg-dark/20 text-sage text-[10px] px-2 py-1 rounded-full flex-shrink-0">
              {plant.source === 'label' ? 'label read' : `${Math.round(probability * 100)}% match`}
            </div>
          </div>
        )}

        <div className="px-4 pb-24 flex flex-col gap-3">

          {/* Key facts grid */}
          {facts.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {facts.map(({ label, value }) => (
                <div key={label} className="bg-leaf rounded-lg px-3 py-2">
                  <p className="text-[10px] text-subtle uppercase tracking-widest mb-0.5">
                    {label}
                  </p>
                  <p className="text-sm text-dark font-medium">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Watering */}
          {plant.watering && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">
                Watering
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.watering}</p>
            </div>
          )}

          {/* Pruning */}
          {(plant.pruning_when || plant.pruning_how) && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">
                Pruning
              </p>
              {plant.pruning_when && (
                <p className="text-sm text-muted leading-relaxed">
                  <span className="font-medium text-dark">When: </span>
                  {plant.pruning_when}
                </p>
              )}
              {plant.pruning_how && (
                <p className="text-sm text-muted leading-relaxed mt-0.5">
                  <span className="font-medium text-dark">How: </span>
                  {plant.pruning_how}
                </p>
              )}
            </div>
          )}

          {/* Winter care */}
          {plant.winter_care && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">
                Winter care
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.winter_care}</p>
            </div>
          )}

          {/* Care notes */}
          {plant.care_notes && (
            <div className="bg-white border-l-2 border-l-fern border border-moss/40
                            rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">
                Care note
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.care_notes}</p>
            </div>
          )}

          {/* Wildlife value */}
          {plant.wildlife_value && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-subtle mb-1 tracking-wide uppercase">
                Wildlife value
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.wildlife_value}</p>
            </div>
          )}

          {/* Toxicity warning */}
          {plant.toxic && (
            <div className="bg-clay/10 border border-clay/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-clay mb-1 tracking-wide">
                ⚠ Toxicity
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.toxic}</p>
            </div>
          )}

          {/* Buyer notes — only shown on name-lookup results */}
          {isResearch && plant.notes_for_buyer && (
            <div className="bg-white border-l-2 border-l-clay border border-clay/30
                            rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-clay mb-1 tracking-wide uppercase">
                Before you buy
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.notes_for_buyer}</p>
            </div>
          )}

          {/* Context label for research results */}
          {isResearch && (
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
              {saving ? 'Saving...' : isResearch ? 'Add to wishlist' : 'Save to library'}
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
  const navigate   = useNavigate()
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const [mode, setMode]           = useState('camera')   // 'camera' | 'search'
  const [cameraReady, setCamReady] = useState(false)
  const [cameraError, setCamError] = useState(null)
  const [cameraGranted, setCameraGranted] = useState(
    () => !!localStorage.getItem('sown_camera_granted')
  )
  const [scanning, setScanning]   = useState(false)
  const [search, setSearch]       = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [result, setResult]       = useState(null)  // { plant, probability, addedAs }
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
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

  // ── Recent scans from Supabase ─────────────────────────────────────────────
  const [recentScans, setRecentScans] = useState([])

  useEffect(() => {
    const fetchRecent = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_plants')
        .select('id, created_at, plants(common_name, latin_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) {
        setRecentScans(data.map(row => ({
          id: row.id,
          common_name: row.plants?.common_name,
          latin_name: row.plants?.latin_name,
          daysAgo: Math.floor((Date.now() - new Date(row.created_at)) / 86400000),
        })))
      }
    }
    fetchRecent()
  }, [saved])

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
    if (mode === 'camera' && cameraGranted) startCamera()
    return () => stopCamera()
  }, [mode, cameraGranted, startCamera, stopCamera])

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
      const identified = await identifyPlant(base64)
      // Fetch photo now so it shows in the card and is ready to save
      const photoUrl = await fetchWikipediaPhoto(identified.plant.latin_name)
      if (photoUrl) identified.plant.photo_url = photoUrl
      setResult(identified)
    } catch (err) {
      showToast('Could not identify plant — try again or search by name')
    } finally {
      setScanning(false)
    }
  }

  // ── AI name lookup — calls Edge Function with plant name ──────────────────
  const handleNameLookup = async (plantName) => {
    if (lookingUp) return
    setLookingUp(true)
    try {
      const plant = await lookupPlantByName(plantName)
      const photoUrl = await fetchWikipediaPhoto(plant.latin_name)
      if (photoUrl) plant.photo_url = photoUrl
      setResult({ plant, probability: 1, addedAs: 'want to grow' })
    } catch (err) {
      console.error('[Sown] name lookup failed:', err)
      showToast(err.message || 'Could not look up that plant — please try again')
    } finally {
      setLookingUp(false)
    }
  }

  // ── Manual search — queries Supabase plants table ─────────────────────────
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await supabase
          .from('plants')
          .select('*')
          .or(`common_name.ilike.%${search}%,latin_name.ilike.%${search}%`)
          .limit(8)
        setSearchResults(data || [])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // ── Fetch user's garden zones (with all condition fields for RAG matching) ──
  const fetchZones = async () => {
    setZonesLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('garden_zones')
        .select('id, name, aspect, sun_exposure, soil_type, soil_drainage, shelter, frost_pocket')
        .eq('user_id', user.id)
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

  // ── Save to Supabase library ───────────────────────────────────────────────
  const handleSave = async (zoneName) => {
    if (!result || saving) return
    setSaving(true)
    setShowZonePicker(false)
    try {
      // 1. Upsert plant into plants table
      const p = result.plant
      const photoUrl = p.photo_url || null
      const { data: plantRow, error: plantErr } = await supabase
        .from('plants')
        .upsert({
          common_name:      p.common_name,
          latin_name:       p.latin_name,
          sun_requirements: p.sun_requirements,
          soil_type:        p.soil_type,
          aspect:           p.aspect,
          height:           p.height           || null,
          spread:           p.spread           || null,
          flowering_season: p.flowering_season || null,
          growth_rate:      p.growth_rate      || null,
          frost_hardiness:  p.frost_hardiness  || null,
          watering:         p.watering         || null,
          pruning_when:     p.pruning_when     || null,
          pruning_how:      p.pruning_how      || null,
          winter_care:      p.winter_care      || null,
          care_notes:       p.care_notes       || null,
          wildlife_value:   p.wildlife_value   || null,
          toxic:            p.toxic            || null,
          notes_for_buyer:  p.notes_for_buyer  || null,
          care_calendar:    p.care_calendar    || null,
          photo_url:        photoUrl           || null,
        }, { onConflict: 'latin_name' })
        .select()
        .single()

      if (plantErr) throw plantErr

      // 2. Add to user's library
      const { data: { user } } = await supabase.auth.getUser()
      const { error: libraryErr } = await supabase
        .from('user_plants')
        .insert({
          user_id:    user.id,
          plant_id:   plantRow.id,
          location:   zoneName || null,
          status:     result.addedAs || 'growing',
          date_added: new Date().toISOString().split('T')[0],
        })

      if (libraryErr) throw libraryErr

      setSaved(true)
      setResult(null)
      showToast('Saved to your library ✓')
      setTimeout(() => navigate('/library'), 1200)

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
      const { data: { user } } = await supabase.auth.getUser()
      const { data: zone, error } = await supabase
        .from('garden_zones')
        .insert({ user_id: user.id, name })
        .select()
        .single()
      if (error) throw error
      await handleSave(zone.name)
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

      {/* Mode toggle */}
      <div className="flex mx-4 mt-4 mb-3 bg-dark/60 rounded-xl p-1 gap-1">
        <button
          onClick={() => setMode('camera')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium tracking-wide
                      transition-colors flex items-center justify-center gap-2
                      ${mode === 'camera' ? 'bg-fern text-sage' : 'text-subtle'}`}
        >
          <ScanIcon size={17} stroke="currentColor" />
          Scan
        </button>
        <button
          onClick={() => setMode('search')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium tracking-wide
                      transition-colors flex items-center justify-center gap-2
                      ${mode === 'search' ? 'bg-fern text-sage' : 'text-subtle'}`}
        >
          <SearchIcon size={16} stroke="currentColor" />
          Search
        </button>
      </div>

      {/* ── Camera mode ─────────────────────────────────────────────────── */}
      {mode === 'camera' && (
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
                <p className="text-moss text-sm">Identifying plant...</p>
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center
                              justify-center gap-3 px-6 text-center">
                <p className="text-sage/80 text-sm leading-relaxed">
                  {cameraError}
                </p>
                <button
                  onClick={() => setMode('search')}
                  className="text-moss text-sm underline underline-offset-2"
                >
                  Search by name instead
                </button>
              </div>
            )}

            {/* Instruction label */}
            {cameraReady && !scanning && (
              <div className="absolute bottom-4 left-0 right-0
                              text-center">
                <p className="text-sage/70 text-xs tracking-wide">
                  Point at a plant or tag
                </p>
              </div>
            )}

          </div>

          {/* Identify button */}
          <button
            onClick={handleIdentify}
            disabled={!cameraReady || scanning}
            className="w-full bg-fern text-sage font-medium text-base
                       py-4 rounded-2xl tracking-wide
                       disabled:opacity-40 active:opacity-80
                       transition-opacity"
          >
            {scanning ? 'Identifying...' : 'Identify plant'}
          </button>

          {/* Switch to search */}
          <button
            onClick={() => setMode('search')}
            className="text-subtle text-sm text-center
                       underline underline-offset-2"
          >
            Can't get a clear shot? Search by name
          </button>

          {/* Scanning tips */}
          <div className="bg-dark/50 border border-subtle/20 rounded-xl p-4">
            <p className="text-sage/60 text-[10px] uppercase tracking-widest font-medium mb-3">
              Getting the best results
            </p>
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-3 items-start">
                <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                <p className="text-sage/70 text-xs leading-relaxed">
                  <span className="text-sage/90 font-medium">Scan the label first.</span>{' '}
                  If your plant has a tag or nursery label, point the camera at that — it gives the most reliable identification.
                </p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                <p className="text-sage/70 text-xs leading-relaxed">
                  <span className="text-sage/90 font-medium">Scan the plant visually</span>{' '}
                  only when there's no label — visual ID works best for distinctive plants but can be less precise.
                </p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="text-fern text-xs mt-0.5 flex-shrink-0">✓</span>
                <p className="text-sage/70 text-xs leading-relaxed">
                  <span className="text-sage/90 font-medium">Not sure about the result?</span>{' '}
                  Use the Search tab to look up by name and confirm before saving.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Search mode ─────────────────────────────────────────────────── */}
      {mode === 'search' && (
        <div className="flex flex-col gap-3 px-4">

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
          {searchResults.map(plant => (
            <button
              key={plant.id}
              onClick={() => setResult({ plant, probability: 1, addedAs: 'growing' })}
              className="w-full bg-dark/60 border border-subtle/30
                         rounded-xl px-4 py-3 text-left
                         active:border-moss transition-colors"
            >
              <p className="text-sm text-sage">{plant.common_name}</p>
              {plant.latin_name && (
                <p className="text-xs text-subtle italic mt-0.5">
                  {plant.latin_name}
                </p>
              )}
            </button>
          ))}

          {/* AI lookup — shown whenever the user has typed something */}
          {search.trim().length > 2 && !searching && (
            <div className="mt-1">
              {searchResults.length === 0 && (
                <p className="text-subtle text-xs text-center mb-3">
                  Not found in your plant database
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
          {!search && (
            <>
              <p className="text-xs text-subtle uppercase tracking-widest
                            mt-2">
                Recent scans
              </p>
              {recentScans.map(s => (
                <RecentPill
                  key={s.id}
                  name={s.common_name}
                  latinName={s.latin_name}
                  daysAgo={s.daysAgo}
                  onClick={() => {
                    // In production: fetch full plant record from Supabase
                    // then setResult({ plant: fullRecord, probability: 1 })
                    showToast('Tap to view full profile — fetch from Supabase here')
                  }}
                />
              ))}
            </>
          )}

        </div>
      )}

      {/* Plant profile result sheet */}
      {result && (
        <PlantProfileCard
          result={result}
          onSave={result.addedAs === 'want to grow'
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
                    const plant = result?.plant
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
                      const dotStyle = score.rag === 'green'   ? { background: '#22c55e' }
                                     : score.rag === 'amber'   ? { background: '#fbbf24' }
                                     : score.rag === 'red'     ? { background: '#ef4444' }
                                     : { background: '#BFCAAD', opacity: 0.5 }
                      const badgeStyle = score.rag === 'green'
                        ? { color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0' }
                        : score.rag === 'amber'
                        ? { color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a' }
                        : score.rag === 'red'
                        ? { color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca' }
                        : { color: '#8A7E6E', background: '#f5f5f4', border: '1px solid #d6d3d1' }
                      const badgeLabel = score.rag === 'unknown' ? 'No zone data' : score.label

                      return (
                        <button
                          key={zone.id}
                          onClick={() => handleSave(zone.name)}
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

// ─── Claude via Supabase Edge Function ───────────────────────────────────────
const EDGE_URL  = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify-plant`
const EDGE_HDRS = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
}

async function identifyPlant(base64Image) {
  const res = await fetch(EDGE_URL, {
    method: 'POST', headers: EDGE_HDRS,
    body: JSON.stringify({ image: base64Image }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Could not identify plant')
  }
  const plant = await res.json()
  if (plant.error) throw new Error(plant.error)
  return { plant, probability: plant.confidence === 'high' ? 0.9 : plant.confidence === 'medium' ? 0.7 : 0.5 }
}

async function lookupPlantByName(name) {
  const res = await fetch(EDGE_URL, {
    method: 'POST', headers: EDGE_HDRS,
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Could not look up plant')
  }
  const plant = await res.json()
  if (plant.error) throw new Error(plant.error)
  return plant
}
