// Low-level HL7 v2 helpers: escaping, timestamps, IDs. No dependencies.

export const SEGMENT_TERMINATOR = '\r'

/** Escape a value for an ER7 field using the standard delimiters |^~\& */
export function esc(value) {
  if (value === undefined || value === null) return ''
  return String(value)
    .replace(/\\/g, '\\E\\')
    .replace(/\|/g, '\\F\\')
    .replace(/\^/g, '\\S\\')
    .replace(/&/g, '\\T\\')
    .replace(/~/g, '\\R\\')
    .replace(/[\r\n]+/g, ' ')
}

/** Join escaped components, dropping trailing empties: comp('a','', 'c','','') -> 'a^^c' */
export function comp(...parts) {
  const out = parts.map(esc)
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('^')
}

/** Build a segment from an array where index n holds field n (index 0 = segment name). */
export function segment(fields) {
  const out = fields.map((f) => (f === undefined || f === null ? '' : f))
  while (out.length > 1 && out[out.length - 1] === '') out.pop()
  return out.join('|')
}

/** '+1000' -> 600 ; '-0530' -> -330 */
export function offsetMinutes(offset) {
  const m = /^([+-])(\d{2})(\d{2})$/.exec(offset || '')
  if (!m) throw new Error(`UTC offset '${offset}' must look like +1000`)
  const mins = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -mins : mins
}

const pad = (n, w = 2) => String(n).padStart(w, '0')

/** Epoch ms -> HL7 DTM 'YYYYMMDDHHMMSS+ZZZZ' in the given fixed offset. */
export function formatDtm(epochMs, offset) {
  const d = new Date(epochMs + offsetMinutes(offset) * 60000)
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}${offset}`
  )
}

/**
 * Local wall-clock time 'YYYY-MM-DDTHH:mm' (an <input type="datetime-local"> value),
 * read in the given fixed offset -> epoch ms. Returns null if it doesn't parse.
 */
export function parseLocal(value, offset) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value || '')
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => Number(x || 0))
  const utc = Date.UTC(y, mo - 1, d, h, mi, s)
  const back = new Date(utc)
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null // e.g. 31 Feb
  return utc - offsetMinutes(offset) * 60000
}

/** FHIR date 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' -> HL7 'YYYY[MM[DD]]' (precision kept). */
export function fhirDateToHl7(date) {
  if (!date) return ''
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(date)
  return m ? m.slice(1).filter(Boolean).join('') : ''
}

const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1, easier to read aloud

function randomChars(n) {
  const bytes = new Uint8Array(n)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALNUM[b % ALNUM.length]).join('')
}

/** 'yyMMddHHmmss' in the given offset */
function stamp(epochMs, offset) {
  return formatDtm(epochMs, offset).slice(2, 14)
}

/** MSH-10: 'G' + yyMMddHHmmss + 4 random = 17 chars (MSH-10 allows 20). */
export function newControlId(offset, now = Date.now()) {
  return `G${stamp(now, offset)}${randomChars(4)}`
}

/** SCH-2.1: 'FIL' + yyMMddHHmmss + 3 random. Letters and digits only. */
export function newFillerId(offset, now = Date.now()) {
  return `FIL${stamp(now, offset)}${randomChars(3)}`
}
