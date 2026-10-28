// Run with: npm test   (Node 18+, no dependencies)
// Fixtures are the Patient, Practitioners and Organization the siu-fhir-au-core reference
// adapter wrote after processing its samples 01 and 03.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { esc, formatDtm, parseLocal, fhirDateToHl7, newFillerId } from '../src/lib/hl7.js'
import { buildS12, toCoded } from '../src/lib/siu.js'
import { DEFAULT_SETTINGS } from '../src/lib/settings.js'
import { APPOINTMENT_REASONS, SERVICES, LOCATION_TYPES, PRACTITIONER_ROLES } from '../src/lib/codes.js'

const fx = JSON.parse(readFileSync(new URL('./fixtures/adapter-resources.json', import.meta.url)))
const settings = { ...DEFAULT_SETTINGS }
const NOW = Date.UTC(2026, 9, 28, 2, 0, 0) // 2026-10-28 12:00 +10:00

const seg = (msg, name) => msg.split('\r').find((s) => s.startsWith(name + '|'))

test('escapes all HL7 delimiters', () => {
  assert.equal(esc('a|b^c&d~e\\f'), 'a\\F\\b\\S\\c\\T\\d\\R\\e\\E\\f')
})

test('timestamps use the configured offset', () => {
  const t = parseLocal('2026-11-03T23:45', '+1000')
  assert.equal(formatDtm(t, '+1000'), '20261103234500+1000')
  assert.equal(formatDtm(t + 45 * 60000, '+1000'), '20261104003000+1000')
  assert.equal(parseLocal('2026-02-31T10:00', '+1000'), null)
  assert.equal(fhirDateToHl7('1980-01'), '198001')
})

test('generated filler IDs are letters and digits only', () => {
  assert.match(newFillerId('+1000', NOW), /^FIL261028120000[A-Z0-9]{3}$/)
})

test('typed codes accept CODE^Display', () => {
  assert.deepEqual(toCoded('POSTOP^Post-op review'), { code: 'POSTOP', display: 'Post-op review', system: 'LOCAL' })
})

test('full booking matches the spec sample layout', () => {
  const r = buildS12(
    {
      fillerId: 'FIL2001', start: '2026-10-14T09:30', duration: 30,
      reason: APPOINTMENT_REASONS.find((x) => x.code === 'FOLLOWUP'), service: SERVICES[0],
      pointOfCare: 'OPD', room: 'CLINIC1', locationDescription: 'Outpatient Clinic 1',
      locationType: LOCATION_TYPES[0], role: PRACTITIONER_ROLES[0],
    },
    { patient: fx.patient, practitioner: fx.practitioner, organization: fx.organization },
    settings, { now: NOW, controlId: 'MSG0001' },
  )
  assert.deepEqual(r.errors, [])
  const m = r.message
  assert.equal(seg(m, 'MSH'), 'MSH|^~\\&|PAS|SIMHOSP|SIU2FHIR|POC|20261028120000+1000||SIU^S12^SIU_S12|MSG0001|P|2.5')
  assert.equal(seg(m, 'SCH'),
    'SCH||FIL2001^SCHED|||||FOLLOWUP^A follow up visit^HL70276||30|min|^^^20261014093000+1000^20261014100000+1000||||||||||||||Booked')
  assert.equal(seg(m, 'PID').split('|')[3], '900001^^^SIMHOSP^MR~8003609900001239^^^AUSHIC^NI~29999999991^^^AUSHIC^MC')
  assert.equal(seg(m, 'AIS'), 'AIS|1|A|GPCONS^General consultation^LOCAL')
  assert.equal(seg(m, 'AIL'), 'AIL|1|A|OPD^CLINIC1^^SIMHOSP^^^^^Outpatient Clinic 1|CLIN^Clinic^LOCAL')
  assert.equal(seg(m, 'AIP'), 'AIP|1|A|8003619900004562^SMITH^JANE^^^DR^^^AUSHIC^^^^NPI|ATND^Attending^LOCAL')
  assert.ok(!m.includes('\n'))
})

test('provider-number practitioner goes in XCN.9 AUSHICPR', () => {
  const r = buildS12({ fillerId: 'F1', start: '2026-10-14T09:30', duration: 15 },
    { patient: fx.patient, practitioner: fx.practitioner2, organization: fx.organization }, settings, { now: NOW })
  assert.equal(seg(r.message, 'AIP'), 'AIP|1|A|2426621B^JONES^RAJ^^^DR^^^AUSHICPR')
})

test('HPI-I is preferred when a practitioner has both', () => {
  const both = { ...fx.practitioner, identifier: [...fx.practitioner2.identifier, ...fx.practitioner.identifier] }
  const r = buildS12({ fillerId: 'F1', start: '2026-10-14T09:30', duration: 15 },
    { patient: fx.patient, practitioner: both, organization: fx.organization }, settings, { now: NOW })
  assert.match(seg(r.message, 'AIP'), /^AIP\|1\|A\|8003619900004562\^.*\^NPI$/)
  assert.ok(r.warnings.some((w) => w.includes('removed from the server copy')))
})

test('missing required inputs block the message', () => {
  const r = buildS12({ fillerId: '', start: '', duration: 0 },
    { patient: fx.patient, practitioner: fx.practitioner, organization: { resourceType: 'Organization' } },
    settings, { now: NOW })
  assert.equal(r.message, null)
  assert.equal(r.errors.length, 4)
})

test('unmappable patient identifiers are left out with a warning', () => {
  const p = { ...fx.patient, identifier: [{ system: 'urn:oid:1.2.3', value: 'X1' }, ...fx.patient.identifier] }
  const r = buildS12({ fillerId: 'F1', start: '2026-10-14T09:30', duration: 15 },
    { patient: p, practitioner: fx.practitioner, organization: fx.organization }, settings, { now: NOW })
  assert.ok(!seg(r.message, 'PID').includes('X1'))
  assert.ok(r.warnings.some((w) => w.includes('urn:oid:1.2.3')))
})
