// src/components/PlantCareDetails.jsx
// The catalogue part of a plant page: verified label, key facts, watering,
// care guide, jobs, problems, tips and safety. Used by the Scan result card
// and the Library detail sheet.
//
// profile:   a plant_profiles_resolved row (variety fields filled from species)
// careTasks: plant_care_tasks_resolved rows for that profile

import {
  label, labelList, formatMonths, formatRange,
  verificationLabel, safetyWording, SAFETY_DISCLAIMER,
} from '../lib/catalogue'

export function CardSection({ title, children, accent }) {
  return (
    <div className={`bg-white border border-moss/40 rounded-xl px-4 py-3
                     ${accent ? 'border-l-2 border-l-fern' : ''}`}>
      <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">{title}</p>
      {children}
    </div>
  )
}

export function FactsGrid({ facts }) {
  const shown = facts.filter(f => f.value)
  if (shown.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2">
      {shown.map(({ label: name, value }) => (
        <div key={name} className="bg-leaf rounded-lg px-3 py-2 min-w-0">
          <p className="text-[10px] text-subtle uppercase tracking-widest mb-0.5">{name}</p>
          <p className="text-sm text-dark font-medium break-words">{value}</p>
        </div>
      ))}
    </div>
  )
}

export function profileFacts(profile) {
  return [
    { label: 'Sun',       value: labelList('sun', profile.sun) },
    { label: 'Soil',      value: labelList('soil_type', profile.soil_type) || label('soil_moisture', profile.soil_moisture) },
    { label: 'Aspect',    value: profile.aspect?.length ? profile.aspect.join(', ') : null },
    { label: 'Height',    value: formatRange(profile.height_cm_min, profile.height_cm_max) },
    { label: 'Flowers',   value: formatMonths(profile.flowering_months) },
    { label: 'Flower colour', value: profile.flower_colours?.length ? profile.flower_colours.join(', ') : null },
    { label: 'Hardiness', value: profile.rhs_hardiness ? `RHS ${profile.rhs_hardiness}` : null },
  ]
}

export function VerificationBadge({ profile }) {
  const verified = profile.status === 'verified'
  return (
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
  )
}

// Safety: HTA list only, never a "safe" badge
export function SafetySection({ profile }) {
  const safety = safetyWording(profile)
  const harmful = safety.tone === 'harmful'
  return (
    <div
      data-testid="safety"
      className={`rounded-xl px-4 py-3 border
                  ${harmful ? 'bg-clay/10 border-clay/40' : 'bg-white border-moss/40'}`}
    >
      <p className={`text-xs font-medium mb-1 tracking-wide uppercase ${harmful ? 'text-clay' : 'text-fern'}`}>
        Safety
      </p>
      {safety.lines.map((line, i) => (
        <p key={i} className="text-sm text-muted leading-relaxed">{line}</p>
      ))}
      <p className="text-[11px] text-subtle leading-relaxed mt-2">{SAFETY_DISCLAIMER}</p>
    </div>
  )
}

// Everything below the verified label and facts grid
export function CareSections({ profile, careTasks = [] }) {
  const careGuide = [
    ['Planting', profile.care_planting],
    ['Ongoing care', profile.care_ongoing],
    ['Through the year', profile.care_through_year],
  ].filter(([, text]) => text)

  const jobs = [...careTasks].sort((a, b) => Math.min(...a.months) - Math.min(...b.months))

  return (
    <>
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

      {careGuide.map(([title, text]) => (
        <CardSection key={title} title={title}>
          <p className="text-sm text-muted leading-relaxed">{text}</p>
        </CardSection>
      ))}

      {jobs.length > 0 && (
        <CardSection title="Jobs through the year" accent>
          <ul className="flex flex-col gap-2 mt-1">
            {jobs.map(t => (
              <li key={t.id} className="text-sm leading-relaxed">
                <span className="font-medium text-dark">{label('task_type', t.task_type)}</span>
                <span className="text-subtle"> · {formatMonths(t.months)}</span>
                {t.repeat === 'ongoing' && <span className="text-subtle text-xs"> · reminder</span>}
                {t.task_trigger === 'after_last_frost' && (
                  <span className="text-subtle text-xs"> · after the last frost</span>
                )}
                <p className="text-muted">{t.instructions}</p>
              </li>
            ))}
          </ul>
        </CardSection>
      )}

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

      <SafetySection profile={profile} />
    </>
  )
}
