import { resolveToEpicureKey } from '../drink-pairing-utils'

// Tests use a small hand-crafted key set so they don't depend on the full
// Epicure embedding file. The function's logic is what's under test.

const KEYS = new Set([
  'chicken',
  'garlic',
  'olive_oil',
  'rice',
  'parsley',
  'salmon',
  'lemon',
])

describe('resolveToEpicureKey', () => {
  // ── exact match ─────────────────────────────────────────────────────────────

  it('returns the key unchanged when it already exists in the set', () => {
    expect(resolveToEpicureKey('chicken', KEYS)).toBe('chicken')
  })

  it('returns null for a key not in the set', () => {
    expect(resolveToEpicureKey('unicorn', KEYS)).toBeNull()
  })

  // ── normalised key match (lowercase + spaces → underscores) ─────────────────

  it('normalises "Olive Oil" (mixed case + spaces) to "olive_oil"', () => {
    expect(resolveToEpicureKey('Olive Oil', KEYS)).toBe('olive_oil')
  })

  it('normalises "OLIVE OIL" to "olive_oil"', () => {
    expect(resolveToEpicureKey('OLIVE OIL', KEYS)).toBe('olive_oil')
  })

  it('normalises "olive oil" (lowercase, space) to "olive_oil"', () => {
    expect(resolveToEpicureKey('olive oil', KEYS)).toBe('olive_oil')
  })

  // ── first-word fallback ──────────────────────────────────────────────────────

  it('resolves "chicken breast" to "chicken" via first-word fallback', () => {
    expect(resolveToEpicureKey('chicken breast', KEYS)).toBe('chicken')
  })

  it('resolves "garlic cloves" to "garlic" via first-word fallback', () => {
    expect(resolveToEpicureKey('garlic cloves', KEYS)).toBe('garlic')
  })

  it('resolves "Salmon Fillet" to "salmon" via first-word fallback', () => {
    expect(resolveToEpicureKey('Salmon Fillet', KEYS)).toBe('salmon')
  })

  // ── last-word fallback ───────────────────────────────────────────────────────

  it('resolves "fresh parsley" to "parsley" via last-word fallback when first word is unknown', () => {
    expect(resolveToEpicureKey('fresh parsley', KEYS)).toBe('parsley')
  })

  it('resolves "juicy lemon" to "lemon" via last-word fallback', () => {
    expect(resolveToEpicureKey('juicy lemon', KEYS)).toBe('lemon')
  })

  // ── last-word not used when same as first ────────────────────────────────────

  it('returns null when the single-word input does not match', () => {
    expect(resolveToEpicureKey('cilantro', KEYS)).toBeNull()
  })

  // ── multi-word with no matches ───────────────────────────────────────────────

  it('returns null when neither first nor last word matches', () => {
    expect(resolveToEpicureKey('fresh cilantro leaves', KEYS)).toBeNull()
  })
})
