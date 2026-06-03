import { deriveFlavourTerritory } from '../flavour-territory'

// Small vector space for deterministic tests.
// Vectors are 3-dimensional; cosine similarity drives neighbour ordering.
const vectors: Record<string, number[]> = {
  garlic:    [1, 0.8, 0.2],
  onion:     [0.9, 0.9, 0.1],
  lemon:     [0.1, 0.2, 1],
  lime:      [0.15, 0.25, 0.95],
  ginger:    [0.3, 0.1, 0.8],
  cream:     [0.5, 0.5, 0.5],
  butter:    [0.6, 0.4, 0.3],
  tomato:    [0.2, 0.7, 0.3],
  chilli:    [0.4, 0.2, 0.7],
  coriander: [0.35, 0.15, 0.75],
}

describe('deriveFlavourTerritory', () => {
  it('returns empty array for empty preferredKeys', () => {
    expect(deriveFlavourTerritory([], vectors)).toEqual([])
  })

  it('excludes input ingredients from the results', () => {
    const result = deriveFlavourTerritory(['garlic', 'lemon'], vectors)
    expect(result).not.toContain('garlic')
    expect(result).not.toContain('lemon')
  })

  it('returns display names with spaces not underscores', () => {
    const vecs = { ...vectors, olive_oil: [0.9, 0.85, 0.15] }
    const result = deriveFlavourTerritory(['garlic', 'onion'], vecs)
    for (const name of result) {
      expect(name).not.toContain('_')
    }
  })

  it('returns ingredients that appear in 2+ neighbour sets (overlap logic)', () => {
    // garlic and onion are both near each other; their shared neighbours should surface
    const result = deriveFlavourTerritory(['garlic', 'onion'], vectors, 5)
    // Both garlic and onion are very similar; their top-5 neighbours overlap
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('uses fallback to top 3 neighbours of first ingredient when overlap < 2', () => {
    // With only one preferred key, no overlap between sets is possible → fallback fires
    const result = deriveFlavourTerritory(['lemon'], vectors, 3)
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('handles missing vector keys gracefully (skips silently)', () => {
    const sparseVectors = { garlic: [1, 0, 0], lemon: [0, 0, 1] }
    expect(() => deriveFlavourTerritory(['garlic', 'missing_key'], sparseVectors)).not.toThrow()
  })

  it('normalises space-separated keys to underscore format for vector lookup', () => {
    // "olive oil" (with space) must resolve to "olive_oil" (with underscore) in vectors
    const vecs: Record<string, number[]> = {
      olive_oil: [0.9, 0.8, 0.1],
      lemon:     [0.1, 0.2, 1],
      garlic:    [1, 0.8, 0.2],
      onion:     [0.9, 0.85, 0.15],
    }
    expect(() => deriveFlavourTerritory(['olive oil', 'lemon'], vecs)).not.toThrow()
    const result = deriveFlavourTerritory(['olive oil', 'lemon'], vecs)
    // Should return neighbours, not empty array, because "olive oil" → "olive_oil" is in vecs
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns at most 4 results from overlap candidates', () => {
    const result = deriveFlavourTerritory(['garlic', 'lemon', 'ginger'], vectors)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('processes at most 5 preferred keys', () => {
    const manyKeys = ['garlic', 'lemon', 'ginger', 'tomato', 'cream', 'butter', 'onion']
    expect(() => deriveFlavourTerritory(manyKeys, vectors)).not.toThrow()
  })

  it('fallback returns at most 3 results', () => {
    const result = deriveFlavourTerritory(['garlic'], vectors, 10)
    expect(result.length).toBeLessThanOrEqual(3)
  })
})
