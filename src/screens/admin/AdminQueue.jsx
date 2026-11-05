// src/screens/admin/AdminQueue.jsx
// Admin home: the catalogue, drafts first, newest first. Includes drafts
// created by users' scans. Tap a plant to open the editor.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import TopBar from '../../components/TopBar'
import { botanicalName } from '../../lib/catalogue'

const SAFETY_LABEL = {
  unknown: 'Safety not checked',
  hta_a: 'HTA A', hta_b: 'HTA B', hta_c: 'HTA C',
  hta_bulb_or_fruit_label: 'HTA bulb/fruit label',
  not_on_hta_list: 'Not on HTA list',
}

export default function AdminQueue() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('draft')     // 'draft' | 'verified' | 'all'
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('plant_profiles')
        .select('id, parent_id, slug, genus, species, cultivar, common_names, status, safety_status, field_sources, created_at')
        .order('created_at', { ascending: false })
      setProfiles(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Varieties take their genus/species (and safety) from their species
  const byId = Object.fromEntries(profiles.map(p => [p.id, p]))
  const rows = profiles.map(p => {
    const parent = p.parent_id ? byId[p.parent_id] : null
    const named = parent ? { ...p, genus: parent.genus, species: parent.species } : p
    return {
      ...p,
      botanical: botanicalName(named),
      common: p.common_names?.[0] || parent?.common_names?.[0] || '',
      safety: p.safety_status ?? parent?.safety_status ?? 'unknown',
      claudeFields: Object.values(p.field_sources || {}).filter(s => s === 'claude').length,
    }
  })

  const q = search.trim().toLowerCase()
  const shown = rows.filter(r =>
    (tab === 'all' || r.status === tab) &&
    (!q || r.botanical.toLowerCase().includes(q) || r.common.toLowerCase().includes(q) || r.slug.includes(q)))
  const count = s => rows.filter(r => s === 'all' || r.status === s).length

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />
      <main className="flex-1 p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-dark text-xl">Plant catalogue</h1>
            <p className="text-xs text-subtle mt-0.5">Admin only. Check drafts, add HTA safety, then verify.</p>
          </div>
          <button onClick={() => navigate('/admin/new')}
            className="bg-fern text-sage text-xs font-medium px-3 py-2 rounded-xl flex-shrink-0">
            + Add from a label
          </button>
        </div>

        <div className="flex gap-2">
          {[['draft', 'Drafts'], ['verified', 'Verified'], ['all', 'All']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                          ${tab === key ? 'bg-fern text-sage' : 'bg-white border border-moss/40 text-subtle'}`}>
              {label} ({count(key)})
            </button>
          ))}
        </div>

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search the catalogue…"
          className="w-full bg-white border border-moss/40 rounded-xl px-3 py-2.5 text-base text-dark
                     focus:outline-none focus:border-fern" />

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-moss/30 border-t-fern rounded-full animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-subtle text-center py-10">Nothing here.</p>
        ) : shown.map(r => (
          <button key={r.id} onClick={() => navigate(`/admin/plant/${r.id}`)}
            className="w-full bg-white border border-moss/40 rounded-xl p-3 text-left active:bg-leaf transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-serif text-dark text-sm leading-tight truncate">{r.common || r.botanical}</p>
                <p className="text-xs text-subtle italic truncate mt-0.5">{r.botanical}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0
                                ${r.status === 'verified' ? 'bg-fern text-sage' : 'border border-clay/40 text-clay'}`}>
                {r.status === 'verified' ? 'Verified' : 'Draft'}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-subtle">
              <span>{r.parent_id ? 'Variety' : 'Species'}</span>
              <span className={r.safety === 'unknown' ? 'text-clay font-medium' : ''}>{SAFETY_LABEL[r.safety]}</span>
              {r.claudeFields > 0 && <span>{r.claudeFields} field{r.claudeFields === 1 ? '' : 's'} from Claude</span>}
              <span>Added {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </button>
        ))}
      </main>
    </div>
  )
}
