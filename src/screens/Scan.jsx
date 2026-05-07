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

// ─── Seed S mark (reused from other screens) ─────────────────────────────────
function SeedMark({ size = 16, color = '#4A5940' }) {
  const h = size
  const w = size * 0.75
  const rx = w * 0.45
  const ry1 = h * 0.3
  const cy1 = h * 0.28
  const cy2 = h * 0.72
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <ellipse cx={w / 2} cy={cy1} rx={rx} ry={ry1} fill={color} />
      <line x1={w * 0.25} y1={h * 0.1} x2={w * 0.55} y2={h * 0.35}
        stroke={color === '#4A5940' ? '#D4DCCA' : '#4A5940'}
        strokeWidth="0.7" strokeLinecap="round" opacity="0.45" />
      <ellipse cx={w / 2} cy={cy2} rx={rx} ry={ry1} fill={color}
        transform={`rotate(180 ${w / 2} ${cy2})`} />
      <line x1={w * 0.35} y1={h * 0.62} x2={w * 0.65} y2={h * 0.87}
        stroke={color === '#4A5940' ? '#D4DCCA' : '#4A5940'}
        strokeWidth="0.7" strokeLinecap="round" opacity="0.45" />
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

// ─── Plant profile card (shown after identification) ──────────────────────────
function PlantProfileCard({ result, onSave, onDismiss, saving }) {
  const { plant, probability } = result

  const facts = [
    { label: 'Sun',    value: plant.sun_requirements },
    { label: 'Aspect', value: plant.aspect },
    { label: 'Height', value: plant.height },
    { label: 'Soil',   value: plant.soil_type },
    { label: 'Season', value: plant.flowering_season },
    { label: 'Growth', value: plant.growth_rate },
  ].filter(f => f.value)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-dark/50 z-40" onClick={onDismiss} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                      bg-parchment rounded-t-2xl z-50 max-h-[85vh]
                      overflow-y-auto">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0
                        bg-parchment z-10">
          <div className="w-10 h-1 bg-moss rounded-full" />
        </div>

        {/* Photo header */}
        {plant.photo_url ? (
          <div className="relative mx-3 rounded-xl overflow-hidden h-44 mb-4">
            <img
              src={plant.photo_url}
              alt={plant.common_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t
                            from-dark/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="font-serif text-parchment text-lg leading-tight">
                {plant.common_name}
              </p>
              <p className="text-xs text-moss italic mt-0.5">
                {plant.latin_name}
              </p>
            </div>
            {/* Confidence badge */}
            <div className="absolute top-3 right-3 bg-fern/90 text-sage
                            text-xs px-2 py-1 rounded-full">
              {Math.round(probability * 100)}% match
            </div>
            {/* Photo label */}
            <div className="absolute top-3 left-3 bg-dark/50 text-parchment
                            text-[10px] px-2 py-1 rounded-full">
              photo
            </div>
          </div>
        ) : (
          <div className="mx-3 bg-fern rounded-xl p-4 mb-4
                          flex items-center gap-3">
            <div className="w-12 h-12 bg-dark/30 rounded-lg flex items-center
                            justify-center flex-shrink-0">
              <SeedMark size={28} color="#D4DCCA" />
            </div>
            <div>
              <p className="font-serif text-sage text-base leading-tight">
                {plant.common_name}
              </p>
              <p className="text-xs text-moss italic mt-0.5">
                {plant.latin_name}
              </p>
            </div>
          </div>
        )}

        <div className="px-4 pb-6 flex flex-col gap-3">

          {/* Key facts grid */}
          {facts.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {facts.map(({ label, value }) => (
                <div key={label} className="bg-leaf rounded-lg px-3 py-2">
                  <p className="text-[10px] text-subtle uppercase
                                tracking-widest mb-0.5">
                    {label}
                  </p>
                  <p className="text-sm text-dark font-medium">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Care note */}
          {plant.care_notes && (
            <div className="bg-white border border-moss/40 rounded-xl
                            px-4 py-3 border-l-2 border-l-fern">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide">
                Care note
              </p>
              <p className="text-sm text-muted leading-relaxed">
                {plant.care_notes}
              </p>
            </div>
          )}

          {/* Wildlife value */}
          {plant.wildlife_value && (
            <div className="bg-white border border-moss/40 rounded-xl
                            px-4 py-3">
              <p className="text-xs font-medium text-subtle mb-1
                            tracking-wide uppercase">
                Wildlife value
              </p>
              <p className="text-sm text-muted leading-relaxed">
                {plant.wildlife_value}
              </p>
            </div>
          )}

          {/* Toxicity warning */}
          {plant.toxic && (
            <div className="bg-clay/10 border border-clay/40 rounded-xl
                            px-4 py-3">
              <p className="text-xs font-medium text-clay mb-1 tracking-wide">
                ⚠ Toxicity
              </p>
              <p className="text-sm text-muted leading-relaxed">
                {plant.toxic}
              </p>
            </div>
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
              {saving ? 'Saving...' : 'Save to library'}
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
  const [scanning, setScanning]   = useState(false)
  const [search, setSearch]       = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [result, setResult]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [toast, setToast]         = useState(null)

  // ── Sample recent scans ────────────────────────────────────────────────────
  // Replace with a Supabase fetch filtered by user_id
  const recentScans = [
    { id: 'r1', common_name: 'Hydrangea macrophylla', latin_name: 'Hydrangea macrophylla', daysAgo: 2 },
    { id: 'r2', common_name: 'Lavandula angustifolia', latin_name: 'Lavandula angustifolia', daysAgo: 5 },
  ]

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
    } catch (err) {
      // Common errors: NotAllowedError (permission denied), NotFoundError (no camera)
      if (err.name === 'NotAllowedError') {
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
    if (mode === 'camera') startCamera()
    return () => stopCamera()
  }, [mode, startCamera, stopCamera])

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
      const identified = await identifyWithPlantId(base64)
      setResult(identified)
    } catch (err) {
      showToast('Could not identify plant — try again or search by name')
    } finally {
      setScanning(false)
    }
  }

  // ── Manual search ──────────────────────────────────────────────────────────
  // In production this queries your Supabase plants table.
  // For now it filters the sample data.
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        // Swap this block for a real Supabase query:
        // const { data } = await supabase
        //   .from('plants')
        //   .select('*')
        //   .ilike('common_name', `%${search}%`)
        //   .limit(8)
        // setSearchResults(data || [])
        const mock = SAMPLE_PLANTS.filter(p =>
          p.common_name.toLowerCase().includes(search.toLowerCase()) ||
          (p.latin_name || '').toLowerCase().includes(search.toLowerCase())
        )
        setSearchResults(mock)
      } finally {
        setSearching(false)
      }
    }, 350) // debounce
    return () => clearTimeout(timer)
  }, [search])

  // ── Save to Supabase library ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!result || saving) return
    setSaving(true)
    try {
      // 1. Upsert plant into plants table
      const { data: plantRow, error: plantErr } = await supabase
        .from('plants')
        .upsert({
          common_name:       result.plant.common_name,
          latin_name:        result.plant.latin_name,
          sun_requirements:  result.plant.sun_requirements,
          soil_type:         result.plant.soil_type,
          aspect:            result.plant.aspect,
          care_notes:        result.plant.care_notes,
          photo_url:         result.plant.photo_url,
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
          status:     'growing',
          date_added: new Date().toISOString().split('T')[0],
        })

      if (libraryErr) throw libraryErr

      setSaved(true)
      setResult(null)
      showToast('Saved to your library ✓')
      setTimeout(() => navigate('/library'), 1200)

    } catch (err) {
      showToast('Could not save — please try again')
    } finally {
      setSaving(false)
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

      {/* TopBar — dark variant for scan screen */}
      <header className="bg-fern px-4 py-3 flex items-center justify-between">
        <SeedMark size={30} color="#D4DCCA" />
        <h1 className="font-serif text-sage text-2xl tracking-widest">Sown</h1>
        <div className="w-6" />
      </header>

      {/* Mode toggle */}
      <div className="flex mx-4 mt-4 mb-3 bg-dark/60 rounded-xl p-1 gap-1">
        {['camera', 'search'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium
                        tracking-wide capitalize transition-colors
                        ${mode === m
                          ? 'bg-fern text-sage'
                          : 'text-subtle hover:text-sage'}`}
          >
            {m === 'camera' ? '📷  Scan' : '🔍  Search'}
          </button>
        ))}
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

            {/* Loading state */}
            {!cameraReady && !cameraError && (
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

        </div>
      )}

      {/* ── Search mode ─────────────────────────────────────────────────── */}
      {mode === 'search' && (
        <div className="flex flex-col gap-3 px-4">

          {/* Search input */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2"
              width="16" height="16" fill="none" viewBox="0 0 24 24"
              stroke="#8A7E6E" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="Type a plant name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-dark/60 border border-subtle/30
                         rounded-xl pl-9 pr-4 py-3 text-sm text-sage
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

          {!searching && search && searchResults.length === 0 && (
            <p className="text-subtle text-sm text-center py-4">
              No plants found for "{search}"
            </p>
          )}

          {searchResults.map(plant => (
            <button
              key={plant.id}
              onClick={() => setResult({ plant, probability: 1 })}
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
          onSave={handleSave}
          onDismiss={() => setResult(null)}
          saving={saving}
        />
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

// ─── Plant.id API integration ─────────────────────────────────────────────────
// Docs: https://plant.id/
// Add VITE_PLANTID_KEY to your .env file
async function identifyWithPlantId(base64Image) {
  const response = await fetch('https://api.plant.id/v3/identification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': import.meta.env.VITE_PLANTID_KEY,
    },
    body: JSON.stringify({
      images: [`data:image/jpeg;base64,${base64Image}`],
      similar_images: false,
      plant_details: [
        'common_names',
        'url',
        'wiki_description',
        'taxonomy',
      ],
    }),
  })

  if (!response.ok) throw new Error('Plant.id API error')

  const data = await response.json()

  // Take the top suggestion
  const top = data.result?.classification?.suggestions?.[0]
  if (!top) throw new Error('No plant identified')

  // Shape into Sown plant profile format
  // The Plant.id API returns scientific name — we enrich with our own
  // care data from Supabase in production. For now returns what we get.
  const plant = {
    common_name:      top.details?.common_names?.[0] || top.name,
    latin_name:       top.name,
    sun_requirements: null,   // enrich from Supabase plants table
    soil_type:        null,   // enrich from Supabase plants table
    aspect:           null,   // enrich from Supabase plants table
    height:           null,   // enrich from Supabase plants table
    flowering_season: null,   // enrich from Supabase plants table
    growth_rate:      null,   // enrich from Supabase plants table
    care_notes:       top.details?.wiki_description?.value?.slice(0, 200) || null,
    wildlife_value:   null,
    toxic:            null,
    photo_url:        top.similar_images?.[0]?.url || null,
  }

  return { plant, probability: top.probability }
}

// ─── Sample plant data (for search fallback) ───────────────────────────────────
// In production the search hits your Supabase plants table.
const SAMPLE_PLANTS = [
  {
    id: 's1',
    common_name: "Dahlia 'Bishop of Llandaff'",
    latin_name:  'Dahlia × hybrida',
    sun_requirements: 'Full sun',
    soil_type:   'Well drained',
    aspect:      'S / SW',
    height:      '90–120cm',
    flowering_season: 'July–October',
    growth_rate: 'Fast',
    care_notes:  'Lift tubers before first frost. Store in a cool dry place over winter.',
    wildlife_value: 'Attracts bees and butterflies.',
    toxic:       null,
    photo_url:   null,
  },
  {
    id: 's2',
    common_name: "Rosa 'Gertrude Jekyll'",
    latin_name:  'Rosa',
    sun_requirements: 'Full sun',
    soil_type:   'Fertile, moist',
    aspect:      'S facing',
    height:      '120–150cm',
    flowering_season: 'June–September',
    growth_rate: 'Moderate',
    care_notes:  'Feed in May and July. Watch for blackspot and aphids.',
    wildlife_value: 'Excellent for bees.',
    toxic:       null,
    photo_url:   null,
  },
  {
    id: 's3',
    common_name: 'Lavandula angustifolia',
    latin_name:  'Lavandula angustifolia',
    sun_requirements: 'Full sun',
    soil_type:   'Well drained',
    aspect:      'S / SE',
    height:      '40–60cm',
    flowering_season: 'June–August',
    growth_rate: 'Slow–moderate',
    care_notes:  'Light trim after flowering. Do not cut into old wood.',
    wildlife_value: 'Excellent for bees and butterflies.',
    toxic:       null,
    photo_url:   null,
  },
  {
    id: 's4',
    common_name: 'Hydrangea macrophylla',
    latin_name:  'Hydrangea macrophylla',
    sun_requirements: 'Partial shade',
    soil_type:   'Moist, well drained',
    aspect:      'E / NE',
    height:      '100–200cm',
    flowering_season: 'July–September',
    growth_rate: 'Moderate',
    care_notes:  'Prune dead heads in spring. Do not prune hard.',
    wildlife_value: 'Attracts some pollinators.',
    toxic:       'Mildly toxic if ingested.',
    photo_url:   null,
  },
  {
    id: 's5',
    common_name: 'Allium Purple Sensation',
    latin_name:  'Allium aflatunense',
    sun_requirements: 'Full sun',
    soil_type:   'Well drained',
    aspect:      'S / SW',
    height:      '60–80cm',
    flowering_season: 'May–June',
    growth_rate: 'Moderate',
    care_notes:  'Plant bulbs 10cm deep in autumn. Leaves die back before flowering — normal.',
    wildlife_value: 'Excellent for bees.',
    toxic:       null,
    photo_url:   null,
  },
]
