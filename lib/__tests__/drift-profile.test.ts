import { computeDriftAwareProfile } from '../drift-profile'
import { type FeedbackRecord } from '../feedback-preferences'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rec(liked: boolean, ingredients: string[], day: number, month = 5): FeedbackRecord {
  return {
    liked,
    recipeIngredients: ingredients,
    timestamp: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00Z`,
  }
}

function liked(ings: string[], day: number, month = 5) { return rec(true,  ings, day, month) }
function disliked(ings: string[], day: number, month = 5) { return rec(false, ings, day, month) }

// Records sorted descending (most recent first) as the caller is expected to provide.
function sortDesc(records: FeedbackRecord[]): FeedbackRecord[] {
  return [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

// ─── Threshold gating ─────────────────────────────────────────────────────────

describe('computeDriftAwareProfile — threshold gating', () => {
  it('returns strength "none" for empty records', () => {
    const p = computeDriftAwareProfile([])
    expect(p.strength).toBe('none')
    expect(p.preferred).toEqual([])
    expect(p.emerging).toEqual([])
    expect(p.fading).toEqual([])
  })

  it('returns strength "none" for 2 records', () => {
    const records = [liked(['garlic', 'garlic'], 1), liked(['garlic', 'garlic'], 2)]
    expect(computeDriftAwareProfile(sortDesc(records)).strength).toBe('none')
  })

  it('returns strength "soft" for 3-9 records', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      liked(['garlic', 'garlic', 'lemon', 'lemon'], i + 1)
    )
    expect(computeDriftAwareProfile(sortDesc(records)).strength).toBe('soft')
  })

  it('returns strength "full" for 10+ records', () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      liked(['garlic', 'garlic', 'lemon', 'lemon'], i + 1)
    )
    expect(computeDriftAwareProfile(sortDesc(records)).strength).toBe('full')
  })
})

// ─── Preferred and avoided (passthrough from all-time profile) ─────────────────

describe('computeDriftAwareProfile — preferred / avoided', () => {
  it('returns preferred ingredients from all-time history', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      liked(['chicken', 'chicken', 'garlic', 'garlic'], i + 1)
    )
    const p = computeDriftAwareProfile(sortDesc(records))
    expect(p.preferred).toContain('chicken')
    expect(p.preferred).toContain('garlic')
  })

  it('returns avoided ingredients from all-time history', () => {
    const records = [
      ...Array.from({ length: 8 }, (_, i) => liked(['chicken', 'chicken'], i + 1)),
      ...Array.from({ length: 8 }, (_, i) => disliked(['fish', 'fish'], i + 1)),
    ]
    const p = computeDriftAwareProfile(sortDesc(records))
    expect(p.avoided).toContain('fish')
  })
})

// ─── Emerging ingredients ──────────────────────────────────────────────────────

describe('computeDriftAwareProfile — emerging', () => {
  // Build a scenario where miso was historically disliked (low all-time score)
  // but is now liked in the most recent 10 records. Five other ingredients fill
  // the all-time top-5, pushing miso to 6th — so it qualifies as emerging when
  // it reaches the recent top-5.
  function buildEmergingRecords() {
    // Historical: 5 consistently liked ingredients fill all-time top-5
    const historical = Array.from({ length: 10 }, (_, i) =>
      liked(['chicken', 'chicken', 'garlic', 'garlic', 'tomato', 'tomato', 'onion', 'onion', 'cumin', 'cumin'], i + 1)
    )
    // miso historically disliked → all-time score ≈ 0.11 (ranked 6th, outside top-5)
    const misoOld = Array.from({ length: 8 }, (_, i) => disliked(['miso', 'miso'], i + 1))
    // miso now liked in the 10 most-recent records → recent score = 1.0 → recent top-1
    const misoRecent = Array.from({ length: 10 }, (_, i) => liked(['miso', 'miso'], i + 1, 6))
    return sortDesc([...historical, ...misoOld, ...misoRecent])
  }

  it('identifies emerging ingredients: in recent top-5 but outside all-time top-5', () => {
    const p = computeDriftAwareProfile(buildEmergingRecords())
    expect(p.emerging).toContain('miso')
  })

  it('returns empty emerging when recent and all-time preferred are identical', () => {
    const records = Array.from({ length: 15 }, (_, i) =>
      liked(['chicken', 'chicken', 'garlic', 'garlic'], i + 1)
    )
    const p = computeDriftAwareProfile(sortDesc(records))
    expect(p.emerging).toEqual([])
  })
})

// ─── Fading ingredients ───────────────────────────────────────────────────────

describe('computeDriftAwareProfile — fading', () => {
  // Mirror of the emerging scenario: the 5 historically dominant ingredients
  // don't appear in the recent 10 records (only miso does), so they're fading.
  function buildFadingRecords() {
    const historical = Array.from({ length: 10 }, (_, i) =>
      liked(['chicken', 'chicken', 'garlic', 'garlic', 'tomato', 'tomato', 'onion', 'onion', 'cumin', 'cumin'], i + 1)
    )
    const misoOld = Array.from({ length: 8 }, (_, i) => disliked(['miso', 'miso'], i + 1))
    const misoRecent = Array.from({ length: 10 }, (_, i) => liked(['miso', 'miso'], i + 1, 6))
    return sortDesc([...historical, ...misoOld, ...misoRecent])
  }

  it('identifies fading ingredients: in all-time top-5 but absent from recent top-5', () => {
    const p = computeDriftAwareProfile(buildFadingRecords())
    expect(p.fading.length).toBeGreaterThan(0)
    expect(p.fading.some(k => ['chicken', 'garlic', 'tomato', 'onion', 'cumin'].includes(k))).toBe(true)
  })

  it('returns empty fading when there is no shift between all-time and recent', () => {
    const records = Array.from({ length: 15 }, (_, i) =>
      liked(['chicken', 'chicken', 'garlic', 'garlic'], i + 1)
    )
    const p = computeDriftAwareProfile(sortDesc(records))
    expect(p.fading).toEqual([])
  })
})

// ─── signalCount ──────────────────────────────────────────────────────────────

describe('computeDriftAwareProfile — signalCount', () => {
  it('reflects the total number of records, not just recent 10', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      liked(['chicken', 'chicken'], i + 1)
    )
    const p = computeDriftAwareProfile(sortDesc(records))
    expect(p.signalCount).toBe(20)
  })
})
