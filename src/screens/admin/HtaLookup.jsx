// src/screens/admin/HtaLookup.jsx
// Search the HTA list for a plant and apply the row Jo chooses (or "Not on
// HTA list"). Never fills safety automatically: every change needs a tap to
// choose and a tap to confirm. Applies to the species record.

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const MATCH = {
  species:         { label: 'This species',          style: 'bg-fern text-sage' },
  cross_reference: { label: 'Cross-reference',       style: 'bg-fern text-sage' },
  genus:           { label: 'Whole genus',           style: 'bg-fern/80 text-sage' },
  synonym:         { label: 'Synonym',               style: 'bg-leaf text-fern' },
  listed_species:  { label: 'Listed species',        style: 'bg-leaf text-fern' },
  other_species:   { label: 'Other species',         style: 'bg-clay/20 text-clay' },
  common_name:     { label: 'Common name only',      style: 'bg-clay/20 text-clay' },
}

function HtaRow({ row, onUse, busy }) {
  const e = row.entry
  const m = MATCH[row.match] || { label: row.match, style: 'bg-leaf text-subtle' }
  const [confirming, setConfirming] = useState(false)
  const weak = ['other_species', 'common_name'].includes(row.match)
  return (
    <div className={`border rounded-xl p-3 flex flex-col gap-1.5 ${weak ? 'border-clay/40 bg-clay/5' : 'border-moss/40 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-dark font-medium italic">{e.scientific_name_as_printed || e.taxon}</p>
          {e.common_names?.length > 0 && <p className="text-xs text-subtle">{e.common_names.join(', ')}</p>}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${m.style}`}>{m.label}</span>
      </div>
      <p className="text-xs text-subtle">{row.note}</p>

      <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 mt-1">
        <dt className="text-subtle">Category</dt><dd className="text-dark">{e.hta_category_as_printed}</dd>
        {e.hta_condition && (<><dt className="text-subtle">Condition</dt><dd className="text-dark font-medium">{e.hta_condition}</dd></>)}
        {e.affects_as_printed && (<><dt className="text-subtle">Affects</dt><dd className="text-dark">{e.affects_as_printed}</dd></>)}
        {e.label_wording_growing && (<><dt className="text-subtle">Label</dt><dd className="text-dark">{e.label_wording_growing}</dd></>)}
        {e.label_wording_bulbs && (<><dt className="text-subtle">Bulb label</dt><dd className="text-dark">{e.label_wording_bulbs}</dd></>)}
        <dt className="text-subtle">Source</dt><dd className="text-dark">{e.hta_ref}, page {e.source_page}{e.specialist_list ? ' · specialist list' : ''}</dd>
      </dl>
      {e.more_than_one_label_applies && (
        <p className="text-xs text-clay font-medium">More than one HTA label applies to this plant: check the guide.</p>
      )}

      {confirming ? (
        <div className="flex gap-2 mt-1">
          <button type="button" disabled={busy} onClick={() => onUse(e.hta_ref)}
            className="flex-1 bg-fern text-sage text-xs font-medium py-2 rounded-lg disabled:opacity-50">
            {busy ? 'Saving…' : `Confirm: use ${e.hta_ref}`}
          </button>
          <button type="button" onClick={() => setConfirming(false)}
            className="flex-1 bg-leaf text-fern text-xs font-medium py-2 rounded-lg">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="self-start text-xs text-fern font-medium underline underline-offset-2 mt-1">
          Use this entry
        </button>
      )}
    </div>
  )
}

export default function HtaLookup({ profileId, initialQuery, onApplied }) {
  const [query, setQuery] = useState(initialQuery || '')
  const [rows, setRows] = useState(null)       // null = not searched yet
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmNotListed, setConfirmNotListed] = useState(false)

  const search = async (e) => {
    e?.preventDefault()
    if (query.trim().length < 2) return
    setSearching(true); setError(null)
    const { data, error: err } = await supabase.rpc('search_hta_entries', { p_query: query.trim() })
    if (err) setError(err.message)
    setRows(data || [])
    setSearching(false)
  }

  const apply = async (htaRef) => {
    setBusy(true); setError(null)
    const { error: err } = await supabase.rpc('set_profile_safety', { p_profile: profileId, p_hta_ref: htaRef })
    setBusy(false)
    if (err) { setError(err.message); return }
    setConfirmNotListed(false)
    onApplied()
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={search} className="flex gap-2">
        <input
          type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Genus, species, synonym or common name"
          className="flex-1 bg-white border border-moss/40 rounded-xl px-3 py-2.5 text-sm text-dark
                     focus:outline-none focus:border-fern"
        />
        <button type="submit" disabled={searching}
          className="bg-fern text-sage text-sm font-medium px-4 rounded-xl disabled:opacity-50">
          {searching ? '…' : 'Search HTA'}
        </button>
      </form>

      {error && <p className="text-sm text-clay">{error}</p>}

      {rows && (
        rows.length === 0
          ? <p className="text-sm text-subtle">No HTA entries match "{query}". Try the genus, a synonym or a common name.</p>
          : <div className="flex flex-col gap-2">
              <p className="text-xs text-subtle">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}. Choose the one that fits this plant, or none.</p>
              {rows.map(r => <HtaRow key={r.entry.hta_ref} row={r} onUse={apply} busy={busy} />)}
            </div>
      )}

      {rows && (
        confirmNotListed ? (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => apply(null)}
              className="flex-1 bg-fern text-sage text-xs font-medium py-2 rounded-lg disabled:opacity-50">
              {busy ? 'Saving…' : 'Confirm: not on the HTA list'}
            </button>
            <button type="button" onClick={() => setConfirmNotListed(false)}
              className="flex-1 bg-leaf text-fern text-xs font-medium py-2 rounded-lg">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmNotListed(true)}
            className="self-start text-xs text-fern font-medium underline underline-offset-2">
            None of these: not on the HTA list
          </button>
        )
      )}
    </div>
  )
}
