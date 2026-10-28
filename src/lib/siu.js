// Builds an HL7 v2.5 SIU^S12 (new booking) message for the siu-fhir-au-core adapter.

import { comp, esc, formatDtm, newControlId, parseLocal, segment, SEGMENT_TERMINATOR } from './hl7.js'
import { facilityCode, patientToPid, practitionerToXcn } from './fhirToHl7.js'

/**
 * A combobox value -> { code, display, system }.
 * Objects from a code list pass through; typed text 'CODE^Display' or 'CODE' becomes a
 * code in the given default coding system.
 */
export function toCoded(v, defaultSystem = 'LOCAL') {
  if (!v) return null
  if (typeof v === 'object') return v.code ? v : null
  const text = String(v).trim()
  if (!text) return null
  const [code, ...rest] = text.split('^')
  return { code: code.trim(), display: rest.join('^').trim(), system: defaultSystem }
}

const ce = (c) => (c ? comp(c.code, c.display || '', c.system || '') : '')

/**
 * @param form      { fillerId, start ('YYYY-MM-DDTHH:mm'), duration (minutes), reason, service,
 *                    pointOfCare, room, bed, locationDescription, locationType, role }
 * @param resources { patient, practitioner, organization } FHIR resources
 * @param settings  see settings.js
 * @param opts      { now: epoch ms, controlId }
 * @returns { message, segments, errors: [], warnings: [] }  message is null when there are errors
 */
export function buildS12(form, resources, settings, opts = {}) {
  const errors = []
  const warnings = []
  const off = settings.utcOffset
  const now = opts.now ?? Date.now()

  const take = (r) => {
    errors.push(...r.errors)
    warnings.push(...r.warnings)
    return r.value
  }

  // --- required inputs ---------------------------------------------------------------
  if (!resources.patient) errors.push('Select a Patient')
  if (!resources.organization) errors.push('Select an Organization')
  if (!resources.practitioner) errors.push('Select a Practitioner')

  const fillerId = (form.fillerId || '').trim()
  if (!fillerId) errors.push('SCH-2 Filler Appointment ID is required')
  else if (!/^[A-Za-z0-9._-]+$/.test(fillerId)) {
    errors.push('SCH-2 Filler Appointment ID: use letters, digits, dot, dash or underscore only')
  }

  const startMs = parseLocal(form.start, off)
  if (startMs === null) errors.push('Start date/time is required')
  const duration = Number(form.duration)
  if (!Number.isInteger(duration) || duration < 1) {
    errors.push('Duration must be a whole number of minutes, 1 or more')
  }

  // --- mapped resources ------------------------------------------------------------
  const pid = resources.patient ? take(patientToPid(resources.patient, settings)) : null
  const xcn = resources.practitioner ? take(practitionerToXcn(resources.practitioner, settings)) : ''
  const facility = resources.organization ? take(facilityCode(resources.organization, settings)) : ''

  if (errors.length) return { message: null, segments: [], errors, warnings }

  // --- segments --------------------------------------------------------------------
  const controlId = opts.controlId || newControlId(off, now)
  const ts = formatDtm(now, off)
  const start = formatDtm(startMs, off)
  const end = formatDtm(startMs + duration * 60000, off)

  const msh =
    'MSH|^~\\&|' +
    [
      esc(settings.sendingApplication),
      esc(settings.sendingFacility || facility),
      esc(settings.receivingApplication),
      esc(settings.receivingFacility),
      ts,
      '',
      'SIU^S12^SIU_S12',
      esc(controlId),
      esc(settings.processingId || 'P'),
      '2.5',
    ].join('|')

  const sch = []
  sch[0] = 'SCH'
  sch[2] = comp(fillerId, settings.fillerNamespace)
  sch[7] = ce(toCoded(form.reason, 'LOCAL'))
  sch[9] = String(duration)
  sch[10] = 'min'
  sch[11] = '^^^' + start + '^' + end
  sch[25] = 'Booked'

  const pidSeg = []
  pidSeg[0] = 'PID'
  pidSeg[1] = '1'
  pidSeg[3] = pid.pid3
  pidSeg[5] = pid.pid5
  pidSeg[7] = pid.pid7
  pidSeg[8] = pid.pid8
  pidSeg[10] = pid.pid10
  pidSeg[11] = pid.pid11
  pidSeg[13] = pid.pid13
  pidSeg[14] = pid.pid14
  pidSeg[15] = pid.pid15

  const segments = [msh, segment(sch), segment(pidSeg), 'RGS|1|A']

  const service = toCoded(form.service, 'LOCAL')
  if (service) segments.push(segment(['AIS', '1', 'A', ce(service)]))

  const ail3 = comp(form.pointOfCare || '', form.room || '', form.bed || '', facility,
    '', '', '', '', form.locationDescription || '')
  segments.push(segment(['AIL', '1', 'A', ail3, ce(toCoded(form.locationType, 'LOCAL'))]))

  const role = toCoded(form.role, 'LOCAL')
  segments.push(segment(['AIP', '1', 'A', xcn, role ? comp(role.code, role.display || '', 'LOCAL') : '']))

  return { message: segments.join(SEGMENT_TERMINATOR), segments, errors, warnings }
}
