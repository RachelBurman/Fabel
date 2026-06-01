/**
 * Resolve a Claude recipe ingredient name to an Epicure key.
 *
 * Claude returns natural-language names like "Chicken Breast" or "garlic cloves".
 * Epicure uses snake_case keys like "chicken" or "garlic". This function tries
 * a cascade of normalisations before giving up.
 *
 * Takes the full key set as a parameter so the logic can be tested without
 * loading the real Epicure embedding data.
 */
export function resolveToEpicureKey(name: string, keySet: Set<string>): string | null {
  if (keySet.has(name)) return name
  const norm = name.toLowerCase().replace(/\s+/g, '_')
  if (keySet.has(norm)) return norm
  const first = norm.split('_')[0]
  if (first && keySet.has(first)) return first
  const last = norm.split('_').at(-1)
  if (last && last !== first && keySet.has(last)) return last
  return null
}
