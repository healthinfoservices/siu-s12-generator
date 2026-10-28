// Minimal FHIR R4 search used by the pickers. Runs in the browser, so the FHIR server must
// allow cross-origin requests (CORS) from wherever this app is served.

const HEADERS = { Accept: 'application/fhir+json' }

async function searchOnce(baseUrl, type, params) {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${type}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: HEADERS })
  } catch {
    throw new Error(
      `Couldn't reach ${url.origin}. Check the FHIR base URL in Settings, and that the server ` +
        'allows cross-origin (CORS) requests from this page.',
    )
  }
  if (!res.ok) throw new Error(`${type} search returned HTTP ${res.status}`)
  const bundle = await res.json()
  return (bundle.entry || []).map((e) => e.resource).filter((r) => r?.resourceType === type)
}

/**
 * Search a resource type by name and by identifier value in parallel; merge by id.
 * An identifier search with a bare value matches that value in any identifier system.
 */
export async function searchResources(baseUrl, type, term, count = 20) {
  const q = term.trim()
  if (!q) return []
  const results = await Promise.allSettled([
    searchOnce(baseUrl, type, { name: q, _count: String(count) }),
    searchOnce(baseUrl, type, { identifier: q, _count: String(count) }),
  ])
  const ok = results.filter((r) => r.status === 'fulfilled')
  if (!ok.length) throw results[0].reason
  const byId = new Map()
  for (const r of ok) for (const res of r.value) byId.set(res.id, res)
  return [...byId.values()].slice(0, count)
}
