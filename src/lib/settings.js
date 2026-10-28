// Settings shown in the Settings dialog. Defaults follow the Track 2B spec and the
// siu-fhir-au-core reference implementation (config.py, mapping.py, samples/).

export const DEFAULT_SETTINGS = Object.freeze({
  // FHIR server the generator reads Patient / Practitioner / Organization from.
  // Default = the reference implementation's FHIR_BASE_URL default (config.py).
  fhirBaseUrl: import.meta.env?.VITE_FHIR_BASE_URL || 'https://gw.interop.community/efiqcon2b/open',

  // MSH. Blank MSH-4 means "use the selected Organization's facility code".
  sendingApplication: 'PAS', // MSH-3
  sendingFacility: '', // MSH-4
  receivingApplication: 'SIU2FHIR', // MSH-5
  receivingFacility: 'POC', // MSH-6
  processingId: 'P', // MSH-11

  // SCH-2.2 filler namespace. The adapter's identifier system becomes
  // {identifierSystemBase}/appointment/filler/{namespace}.
  fillerNamespace: 'SCHED',

  // UTC offset written on every timestamp. Brisbane has no daylight saving.
  utcOffset: '+1000',

  // Identifier systems used by the adapter (must match its configuration).
  identifierSystemBase: 'http://example.org/fhir/sid', // IDENTIFIER_SYSTEM_BASE
  mrnSystemBase: 'http://example.org/fhir/sid/mrn', // MRN_SYSTEM_BASE
  organizationIdSystem: 'http://example.org/fhir/sid/organization', // ORGANIZATION_ID_SYSTEM
})

const KEY = 'siu-s12-generator.settings'

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // storage unavailable or corrupt: fall back to defaults
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // storage unavailable: settings last for this page load only
  }
}
