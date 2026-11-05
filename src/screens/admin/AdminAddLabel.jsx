// src/screens/admin/AdminAddLabel.jsx
// Admin "Add from a label": photos of a nursery label (front, optional back)
// and optional photos of the plant. Claude reads the label and drafts the
// profile; the editor opens on the result.
//
// Label photos go to the private catalogue-label-photos bucket and are never
// shown to users. Plant photos must be Jo's own (catalogue-photos).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { resizeToJpeg } from '../../lib/images'
import TopBar from '../../components/TopBar'
import { Section } from './adminFields'

function PhotoPicker({ label, hint, files, onChange, multiple, testId }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-subtle uppercase tracking-widest font-medium">{label}</p>
      {hint && <p className="text-xs text-subtle -mt-1">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div key={i} className="relative">
            <img src={URL.createObjectURL(f)} alt="" className="w-24 h-24 object-cover rounded-lg border border-moss/40" />
            <button type="button" aria-label="Remove photo" onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-dark text-sage text-xs">×</button>
          </div>
        ))}
        {(multiple || files.length === 0) && (
          <label className="w-24 h-24 rounded-lg border-2 border-dashed border-moss/60 flex items-center justify-center
                            text-xs text-subtle cursor-pointer active:bg-leaf text-center px-2">
            {files.length ? '+ Add' : 'Take or choose photo'}
            <input type="file" accept="image/*" multiple={multiple} className="hidden" data-testid={testId}
              onChange={e => { onChange([...files, ...Array.from(e.target.files || [])].slice(0, multiple ? 4 : 1)); e.target.value = '' }} />
          </label>
        )}
      </div>
    </div>
  )
}

const STEPS = { preparing: 'Preparing photos…', uploading: 'Uploading…', reading: 'Claude is reading the label. This can take up to a minute…' }

export default function AdminAddLabel() {
  const navigate = useNavigate()
  const [front, setFront] = useState([])
  const [back, setBack] = useState([])
  const [plants, setPlants] = useState([])
  const [step, setStep] = useState(null)
  const [error, setError] = useState(null)

  const submit = async () => {
    setError(null)
    const batch = `_incoming/${crypto.randomUUID()}`
    const uploaded = []   // { bucket, path } for clean-up if something fails
    try {
      setStep('preparing')
      const labelFiles = [['front', front[0]], ['back', back[0]]].filter(([, f]) => f)
      const labelBlobs = await Promise.all(labelFiles.map(([, f]) => resizeToJpeg(f, 2000, 0.88)))
      const plantBlobs = await Promise.all(plants.map(f => resizeToJpeg(f, 1200, 0.8)))

      setStep('uploading')
      const put = async (bucket, path, blob) => {
        const { error: err } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
        if (err) throw new Error(`Upload failed: ${err.message}`)
        uploaded.push({ bucket, path })
        return path
      }
      const label_photos = []
      for (const [i, [side]] of labelFiles.entries()) {
        label_photos.push({ side, path: await put('catalogue-label-photos', `${batch}/label_${side}.jpg`, labelBlobs[i]) })
      }
      const plant_photos = []
      for (const [i, blob] of plantBlobs.entries()) {
        plant_photos.push(await put('catalogue-photos', `${batch}/plant_${i + 1}.jpg`, blob))
      }

      setStep('reading')
      const { data, error: fnErr } = await supabase.functions.invoke('draft-from-label', { body: { label_photos, plant_photos } })
      if (fnErr) {
        const details = await fnErr.context?.json?.().catch(() => null)
        throw new Error(details?.error || 'Claude could not draft this plant. Please try again.')
      }
      // The function files the photos itself, so nothing to clean up now
      uploaded.length = 0
      navigate(`/admin/plant/${data.profile_id}`, { state: { fromLabel: data } })
    } catch (err) {
      setError(err.message)
      // The function removes its own uploads on failure; remove ours if it never ran
      for (const u of uploaded) await supabase.storage.from(u.bucket).remove([u.path]).catch(() => {})
    } finally {
      setStep(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-24">
      <TopBar />
      <main className="flex-1 p-4 flex flex-col gap-4">
        <div>
          <button onClick={() => navigate('/admin')} className="text-xs text-fern underline underline-offset-2">← Catalogue</button>
          <h1 className="font-serif text-dark text-xl mt-2">Add from a label</h1>
          <p className="text-xs text-subtle mt-0.5">
            Claude reads the label and drafts the plant. Facts printed on the label are marked "Label".
            Label photos stay private and are never shown to users.
          </p>
        </div>

        <Section title="Label">
          <PhotoPicker label="Front (required)" files={front} onChange={setFront} testId="front-input" />
          <PhotoPicker label="Back" hint="Optional, but backs usually carry the care facts." files={back} onChange={setBack} testId="back-input" />
        </Section>

        <Section title="Your plant photos">
          <PhotoPicker label="Plant photos" hint="Optional. Your own photos only (never grower or label images). Up to 4."
                       files={plants} onChange={setPlants} multiple testId="plant-input" />
        </Section>

        {error && <p className="text-sm text-dark bg-clay/20 rounded-lg px-3 py-2">{error}</p>}

        <button type="button" onClick={submit} disabled={!front.length || !!step}
          className="bg-fern text-sage text-sm font-medium py-3.5 rounded-xl disabled:opacity-40">
          {step ? STEPS[step] : 'Read label and draft the plant'}
        </button>
      </main>
    </div>
  )
}
