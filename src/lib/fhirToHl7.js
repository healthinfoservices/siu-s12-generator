// FHIR R4 (as written by the siu-fhir-au-core adapter) -> HL7 v2.5 field values.
// Each function is the reverse of the adapter's mapping (siu2fhir_au/mapping.py), so a
// resource the adapter created comes back unchanged when the generated message is processed.
// Every function returns { value, warnings: [], errors: [] }.

import { comp, fhirDateToHl7 } from './hl7.js'

export const SYS_IHI = 'http://ns.electronichealth.net.au/id/hi/ihi/1.0'
export const SYS_MEDICARE = 'http://ns.electronichealth.net.au/id/medicare-number'
export const SYS_DVA = 'http://ns.electronichealth.net.au/id/dva'
export const SYS_HPII = 'http://ns.electronichealth.net.au/id/hi/hpii/1.0'
export const SYS_MEDICARE_PROVIDER = 'http://ns.electronichealth.net.au/id/medicare-provider-number'
export const EXT_INDIGENOUS = 'http://hl7.org.au/fhir/StructureDefinition/indigenous-status'

export function luhnOk(digits) {
  let total = 0
  ;[...digits].reverse().forEach((ch, i) => {
    let d = Number(ch)
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    total += d
  })
  return total % 10 === 0
}

/** Problem with an IHI / HPI-I value, as the adapter checks it, or null. */
export function hiNumberProblem(value, prefix, label) {
  if (!/^[0-9]{16}$/.test(value)) return `${label} ${value} is not exactly 16 digits`
  if (!value.startsWith(prefix)) return `${label} ${value} does not start with ${prefix}`
  if (!luhnOk(value)) return `${label} ${value} fails the Luhn check`
  return null
}

const trimSlash = (s) => (s || '').replace(/\/+$/, '')

/** Split '{base}/a/b' into decoded ['a','b'] if system starts with base + '/', else null. */
function systemParts(system, base) {
  const prefix = trimSlash(base) + '/'
  if (!system || !system.startsWith(prefix)) return null
  return system
    .slice(prefix.length)
    .split('/')
    .map((p) => {
      const v = decodeURIComponent(p)
      return v === 'default' ? '' : v
    })
}

// ---------------------------------------------------------------------------
// Patient -> PID
// ---------------------------------------------------------------------------

/** One Patient.identifier -> CX string, or { skip: reason }. */
export function identifierToCx(ident, settings) {
  const { system = '', value = '' } = ident
  if (!value) return { skip: 'has no value' }

  if (system === SYS_IHI) return { cx: comp(value, '', '', 'AUSHIC', 'NI') }
  if (system === SYS_MEDICARE) {
    const expiry = fhirDateToHl7(ident.period?.end)
    return { cx: comp(value, '', '', 'AUSHIC', 'MC', '', '', expiry) }
  }
  if (system === SYS_DVA) {
    return {
      skip:
        'is a DVA number; the adapter stores DVA numbers under a local system, so sending it ' +
        'would not match this identifier',
    }
  }
  const mrn = systemParts(system, settings.mrnSystemBase)
  if (mrn && mrn.length === 1) return { cx: comp(value, '', '', mrn[0], 'MR') }

  const local = systemParts(system, settings.identifierSystemBase)
  if (local && local[0] === 'patient' && local.length === 3) {
    const [, authority, type] = local
    return { cx: comp(value, '', '', authority, type === 'id' ? '' : type) }
  }
  return { skip: `has system ${system || '(none)'}, which has no PID-3 mapping in the adapter` }
}

function nameToXpn(name) {
  const given = name.given || []
  const type = name.use === 'official' ? 'L' : ''
  return comp(name.family || '', given[0] || '', given[1] || '', (name.suffix || [])[0] || '',
    (name.prefix || [])[0] || '', '', type)
}

function addressToXad(a) {
  const line = a.line || []
  return comp(line[0] || '', line[1] || '', a.city || '', a.state || '', a.postalCode || '',
    a.country || '')
}

const GENDER = { male: 'M', female: 'F', other: 'O', unknown: 'U' }

export function patientToPid(patient, settings) {
  const warnings = []
  const errors = []
  const out = {}

  const cxs = []
  const skipped = []
  for (const ident of patient.identifier || []) {
    const r = identifierToCx(ident, settings)
    if (r.skip) {
      skipped.push(`${ident.value || '(no value)'} ${r.skip}`)
      continue
    }
    if (ident.system === SYS_IHI) {
      const p = hiNumberProblem(ident.value, '800360', 'IHI')
      if (p) warnings.push(`${p}; the adapter will drop it`)
    }
    if (ident.system === SYS_MEDICARE && !/^[0-9]{10,11}$/.test(ident.value)) {
      warnings.push(`Medicare number ${ident.value} isn't 10 or 11 digits; the adapter will drop it`)
    }
    cxs.push(r.cx)
  }
  for (const s of skipped) warnings.push(`Patient identifier ${s}. Left out of PID-3.`)
  if (skipped.length && cxs.length) {
    warnings.push(
      'The adapter rebuilds the Patient from the message, so identifiers left out of PID-3 ' +
        'will be removed from the server copy.',
    )
  }
  if (!cxs.length) errors.push('Patient has no identifier the adapter can use for PID-3')
  out.pid3 = cxs.join('~')

  const names = (patient.name || []).filter((n) => n.family || (n.given || []).length)
  out.pid5 = names.map(nameToXpn).join('~')
  if (!names.some((n) => n.family)) {
    warnings.push('Patient has no family name; the adapter will record it as data-absent')
  }

  out.pid7 = fhirDateToHl7(patient.birthDate)
  if (!out.pid7) warnings.push('Patient has no birth date; the adapter will record it as data-absent')

  out.pid8 = GENDER[patient.gender] || ''
  if (!out.pid8) warnings.push('Patient has no gender; the adapter will record "unknown"')

  const indig = (patient.extension || []).find((e) => e.url === EXT_INDIGENOUS)
  out.pid10 = indig?.valueCoding?.code
    ? comp(indig.valueCoding.code, indig.valueCoding.display || '', 'AUSINDIGENOUS')
    : ''

  out.pid11 = (patient.address || [])
    .filter((a) => (a.line || []).length || a.city || a.state || a.postalCode || a.country)
    .map(addressToXad)
    .join('~')

  const home = []
  const work = []
  for (const t of patient.telecom || []) {
    if (!t.value) continue
    if (t.system === 'email') {
      ;(t.use === 'work' ? work : home).push(comp('', 'NET', 'Internet', t.value))
    } else if (t.system === 'phone') {
      if (t.use === 'work') work.push(comp(t.value, 'WPN', 'PH'))
      else if (t.use === 'mobile') home.push(comp(t.value, 'PRN', 'CP'))
      else home.push(comp(t.value, 'PRN', 'PH'))
    }
  }
  out.pid13 = home.join('~')
  out.pid14 = work.join('~')

  const lang = patient.communication?.[0]?.language
  if (lang) {
    const coding = (lang.coding || []).find((c) => c.system === 'urn:ietf:bcp:47')
    const code = coding?.code || ''
    const text = lang.text || coding?.display || ''
    const csys = code ? (/^[a-z]{2,3}$/i.test(code) ? 'ISO639' : 'BCP47') : ''
    out.pid15 = comp(code, text, csys)
  } else out.pid15 = ''

  return { value: out, warnings, errors }
}

// ---------------------------------------------------------------------------
// Practitioner -> AIP-3 (XCN)
// ---------------------------------------------------------------------------

/** Pick the identifier for AIP-3: HPI-I, else Medicare provider number, else local. */
export function practitionerIdentifier(practitioner, settings) {
  const ids = practitioner.identifier || []
  const hpii = ids.find((i) => i.system === SYS_HPII && i.value)
  if (hpii) return { ident: hpii, authority: 'AUSHIC', type: 'NPI', label: 'HPI-I' }
  const prov = ids.find((i) => i.system === SYS_MEDICARE_PROVIDER && i.value)
  if (prov) return { ident: prov, authority: 'AUSHICPR', type: '', label: 'Medicare provider number' }
  for (const i of ids) {
    const p = systemParts(i.system, settings.identifierSystemBase)
    if (p && p[0] === 'practitioner' && p.length === 2 && i.value) {
      return { ident: i, authority: p[1], type: '', label: 'local identifier' }
    }
  }
  return null
}

export function practitionerToXcn(practitioner, settings) {
  const warnings = []
  const errors = []
  const names = practitioner.name || []
  const name = names.find((n) => n.family) || names[0] || {}
  const family = name.family || ''
  const given = (name.given || [])[0] || ''
  const prefix = (name.prefix || [])[0] || ''

  const pick = practitionerIdentifier(practitioner, settings)
  if (!pick) {
    warnings.push(
      'Practitioner has no HPI-I, Medicare provider number or adapter-style local identifier; ' +
        'AIP-3 carries the name only, so the adapter will not link a Practitioner',
    )
    return { value: comp('', family, given, '', '', prefix), warnings, errors }
  }
  const value = pick.ident.value
  if (pick.type === 'NPI') {
    const p = hiNumberProblem(value, '800361', 'HPI-I')
    if (p) warnings.push(`${p}; the adapter will keep it as a local identifier`)
  }
  if (!family) {
    warnings.push('Practitioner has no family name; the adapter will not create a Practitioner')
  }
  const others = (practitioner.identifier || []).filter((i) => i !== pick.ident)
  if (others.length) {
    warnings.push(
      `AIP-3 carries the ${pick.label} only. The adapter rebuilds the Practitioner from the ` +
        `message, so its other ${others.length} identifier(s) will be removed from the server copy.`,
    )
  }
  return {
    value: comp(value, family, given, '', '', prefix, '', '', pick.authority, '', '', '', pick.type),
    warnings,
    errors,
  }
}

// ---------------------------------------------------------------------------
// Organization -> facility code (AIL-3.4)
// ---------------------------------------------------------------------------

export function facilityCode(organization, settings) {
  const ident = (organization.identifier || []).find(
    (i) => i.system === settings.organizationIdSystem && i.value,
  )
  if (!ident) {
    return {
      value: '',
      warnings: [],
      errors: [
        `Organization has no identifier with system ${settings.organizationIdSystem}, ` +
          'so the adapter could not find it from AIL-3.4',
      ],
    }
  }
  return { value: ident.value, warnings: [], errors: [] }
}
