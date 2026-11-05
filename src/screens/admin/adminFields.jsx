// src/screens/admin/adminFields.jsx
// Form inputs for the admin plant editor. Every input works with the
// database's own values: '' / [] mean "not set" (saved as null).

const SOURCE_STYLE = {
  claude: 'bg-clay/15 text-clay',
  label:  'bg-leaf text-fern',
  api:    'bg-leaf text-fern',
  jo:     'bg-fern text-sage',
}
const SOURCE_LABEL = { claude: 'Claude', label: 'Label', api: 'API', jo: 'Jo' }

// Wraps one field: label, where the value came from, and (on a variety)
// what it inherits from its species when left empty.
export function Field({ label, source, inherited, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">{label}</label>
        {source && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_STYLE[source] || 'bg-leaf text-subtle'}`}>
            {SOURCE_LABEL[source] || source}
          </span>
        )}
      </div>
      {children}
      {inherited && (
        <p className="text-[11px] text-subtle leading-snug">
          <span className="font-medium">From species:</span> {inherited}
        </p>
      )}
      {hint && <p className="text-[11px] text-subtle leading-snug">{hint}</p>}
    </div>
  )
}

const inputClass = `w-full bg-white border border-moss/40 rounded-xl px-3 py-2.5 text-sm text-dark
                    placeholder:text-subtle/50 focus:outline-none focus:border-fern transition-colors`

export function TextInput({ value, onChange, placeholder }) {
  return <input type="text" className={inputClass} value={value ?? ''} placeholder={placeholder}
                onChange={e => onChange(e.target.value)} />
}

export function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return <textarea className={`${inputClass} resize-y`} rows={rows} value={value ?? ''} placeholder={placeholder}
                   onChange={e => onChange(e.target.value)} />
}

// One item per line ↔ text[]
export function ListInput({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      className={`${inputClass} resize-y`} rows={rows} placeholder={placeholder}
      value={(value || []).join('\n')}
      onChange={e => onChange(e.target.value.split('\n'))}
    />
  )
}

function Pill({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors
                  ${active ? 'bg-fern text-sage border-fern' : 'bg-white border-moss/40 text-subtle'}`}>
      {children}
    </button>
  )
}

// One value from a list; tap the selected one again to clear
export function Choice({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <Pill key={o.value} active={value === o.value} onClick={() => onChange(value === o.value ? '' : o.value)}>
          {o.label}
        </Pill>
      ))}
    </div>
  )
}

// Any number of values from a list
export function MultiChoice({ options, value, onChange }) {
  const set = new Set(value || [])
  const toggle = v => onChange(options.map(o => o.value).filter(x => (x === v ? !set.has(v) : set.has(x))))
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => <Pill key={o.value} active={set.has(o.value)} onClick={() => toggle(o.value)}>{o.label}</Pill>)}
    </div>
  )
}

export function YesNo({ value, onChange }) {
  return (
    <Choice
      options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]}
      value={value}
      onChange={v => onChange(v === '' ? null : v)}
    />
  )
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthsPicker({ value, onChange }) {
  const set = new Set(value || [])
  return (
    <div className="grid grid-cols-12 gap-1">
      {MONTHS.map((m, i) => {
        const n = i + 1
        return (
          <button key={n} type="button" title={MONTH_NAMES[i]} aria-label={MONTH_NAMES[i]}
            onClick={() => onChange([...Array(12).keys()].map(k => k + 1)
              .filter(x => (x === n ? !set.has(n) : set.has(x))))}
            className={`h-8 rounded-lg text-xs font-medium border transition-colors
                        ${set.has(n) ? 'bg-fern text-sage border-fern' : 'bg-white border-moss/40 text-subtle'}`}>
            {m}
          </button>
        )
      })}
    </div>
  )
}

// Min and max numbers (e.g. height in cm)
export function RangeInput({ min, max, onChange, unit = 'cm' }) {
  const num = v => (v === '' || v == null ? '' : v)
  const parse = v => (v === '' ? '' : Math.max(0, parseInt(v, 10) || 0))
  return (
    <div className="flex items-center gap-2">
      <input type="number" inputMode="numeric" min="0" className={inputClass} placeholder="min"
             value={num(min)} onChange={e => onChange(parse(e.target.value), max)} />
      <span className="text-subtle text-sm">to</span>
      <input type="number" inputMode="numeric" min="0" className={inputClass} placeholder="max"
             value={num(max)} onChange={e => onChange(min, parse(e.target.value))} />
      <span className="text-subtle text-sm">{unit}</span>
    </div>
  )
}

// [{problem, what_to_do}] as "Problem: what to do" lines
export function ProblemsInput({ value, onChange }) {
  return (
    <textarea
      className={`${inputClass} resize-y`} rows={4}
      placeholder={'One per line, e.g.\nRosemary beetle: pick off by hand in spring.'}
      value={(value || []).map(p => (p.what_to_do ? `${p.problem}: ${p.what_to_do}` : p.problem)).join('\n')}
      onChange={e => onChange(e.target.value.split('\n').map(line => {
        const i = line.indexOf(':')
        return i === -1 ? { problem: line, what_to_do: '' }
                        : { problem: line.slice(0, i), what_to_do: line.slice(i + 1).trimStart() }
      }))}
    />
  )
}

export function Section({ title, children, right }) {
  return (
    <section className="bg-white border border-moss/40 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-dark text-lg">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}
