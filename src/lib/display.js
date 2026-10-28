// Labels for picker items.

import { SYS_HPII, SYS_IHI, SYS_MEDICARE_PROVIDER } from './fhirToHl7.js'

export function humanName(r) {
  const n = (r.name || []).find((x) => x.use === 'official') || (r.name || [])[0]
  if (!n) return '(no name)'
  if (typeof n === 'string') return n
  return n.text || [...(n.prefix || []), ...(n.given || []), n.family].filter(Boolean).join(' ') || '(no name)'
}

export function patientSubtitle(p) {
  const ihi = (p.identifier || []).find((i) => i.system === SYS_IHI)
  const first = ihi || (p.identifier || [])[0]
  return [p.birthDate && `DOB ${p.birthDate}`, p.gender, first && `${ihi ? 'IHI' : 'ID'} ${first.value}`]
    .filter(Boolean)
    .join(' · ')
}

export function practitionerSubtitle(p) {
  const ids = p.identifier || []
  const hpii = ids.find((i) => i.system === SYS_HPII)
  const prov = ids.find((i) => i.system === SYS_MEDICARE_PROVIDER)
  return [hpii && `HPI-I ${hpii.value}`, prov && `Provider no. ${prov.value}`].filter(Boolean).join(' · ') ||
    (ids[0] ? `ID ${ids[0].value}` : 'no identifiers')
}

export function organizationTitle(o) {
  return o.name || '(no name)'
}

export function organizationSubtitle(o, settings) {
  const code = (o.identifier || []).find((i) => i.system === settings.organizationIdSystem)
  return code ? `Facility code ${code.value}` : 'No facility code identifier'
}
