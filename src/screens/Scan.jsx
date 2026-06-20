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
    { label: 'Sun',      value: plant.sun_requirements },
    { label: 'Soil',     value: plant.soil_type },
    { label: 'Aspect',   value: plant.aspect },
    { label: 'Height',   value: plant.height },
    { label: 'Season',   value: plant.flowering_season },
    { label: 'Frost',    value: plant.frost_hardiness },
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

        {/* Header */}
        <div className="mx-3 bg-fern rounded-xl p-4 mb-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-dark/30 rounded-lg flex items-center
                          justify-center flex-shrink-0">
            <SeedMark size={28} color="#D4DCCA" />
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

        <div className="px-4 pb-6 flex flex-col gap-3">

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
      const identified = await identifyPlant(base64)
      setResult(identified)
    } catch (err) {
      showToast('Could not identify plant — try again or search by name')
    } finally {
      setScanning(false)
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
          flowering_season:  result.plant.flowering_season,
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

// ─── Claude vision via Supabase Edge Function ────────────────────────────────
async function identifyPlant(base64Image) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const response = await fetch(`${supabaseUrl}/functions/v1/identify-plant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ image: base64Image }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || 'Could not identify plant')
  }

  const plant = await response.json()
  if (plant.error) throw new Error(plant.error)

  return { plant, probability: plant.confidence === 'high' ? 0.9 : plant.confidence === 'medium' ? 0.7 : 0.5 }
}
