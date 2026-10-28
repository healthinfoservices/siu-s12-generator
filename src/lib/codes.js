// Code lists offered in the form. Free entry is allowed for every coded field.

// SCH-7 -> Appointment.appointmentType. HL7 table 0276 (Appointment reason codes).
// Written from memory: check against https://hl7.org/fhir/R4/v2/0276/index.html
export const APPOINTMENT_REASONS = [
  { code: 'CHECKUP', display: 'A routine check-up', system: 'HL70276' },
  { code: 'EMERGENCY', display: 'Emergency appointment', system: 'HL70276' },
  { code: 'FOLLOWUP', display: 'A follow up visit', system: 'HL70276' },
  { code: 'ROUTINE', display: 'Routine appointment', system: 'HL70276' },
  { code: 'WALKIN', display: 'A previously unscheduled walk-in visit', system: 'HL70276' },
]

// AIS-3 -> Appointment.serviceType. Local codes; the first two are from the spec's samples.
export const SERVICES = [
  { code: 'GPCONS', display: 'General consultation', system: 'LOCAL' },
  { code: 'PHYSIO', display: 'Physiotherapy', system: 'LOCAL' },
]

// AIL-4 -> Location.type. Local codes, translated by the adapter's registry when listed.
export const LOCATION_TYPES = [{ code: 'CLIN', display: 'Clinic', system: 'LOCAL' }]

// AIP-4 -> participant.type. Codes the adapter maps to standard code systems (au.py).
export const PRACTITIONER_ROLES = [
  { code: 'ATND', display: 'Attending' },
  { code: 'ADM', display: 'Admitter' },
  { code: 'CALLBCK', display: 'Callback contact' },
  { code: 'CON', display: 'Consultant' },
  { code: 'DIS', display: 'Discharger' },
  { code: 'ESC', display: 'Escort' },
  { code: 'REF', display: 'Referrer' },
  { code: 'SPRF', display: 'Secondary performer' },
  { code: 'PPRF', display: 'Primary performer' },
  { code: 'PART', display: 'Participation' },
  { code: 'translator', display: 'Translator' },
  { code: 'emergency', display: 'Emergency' },
]
