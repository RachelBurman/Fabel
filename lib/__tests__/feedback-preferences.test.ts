import {
  computePreferenceProfile,
  buildTasteProfileClause,
  type FeedbackRecord,
} from '../feedback-preferences'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rec(liked: boolean, ingredients: string[], day: number): FeedbackRecord {
  return {
    liked,
    recipeIngredients: ingredients,
    timestamp: `2026-05-${String(day).padStart(2, '0')}T12:00:00Z`,
  }
}

function liked(ingredients: string[], day: number) { return rec(true,  ingredients, day) }
function disliked(ingredients: string[], day: number) { return rec(false, ingredients, day) }

// ─── threshold gating ─────────────────────────────────────────────────────────

describe('computePreferenceProfile — threshold gating', () => {
  it('returns strength "none" for 0 records', () => {
    expect(computePreferenceProfile([]).strength).toBe('none')
  })

  it('returns strength "none" for 1 record', () => {
    expect(computePreferenceProfile([liked(['garlic', 'garlic'], 1)]).strength).toBe('none')
  })

  it('returns strength "none" for 2 records', () => {
    const records = [liked(['garlic', 'garlic'], 1), liked(['garlic', 'garlic'], 2)]
    expect(computePreferenceProfile(records).strength).toBe('none')
  })

  it('returns strength "soft" for exactly 3 records', () => {
    const records = [
      liked(['garlic', 'garlic'], 1),
      liked(['garlic', 'garlic'], 2),
      liked(['garlic', 'garlic'], 3),
    ]
    expect(computePreferenceProfile(records).strength).toBe('soft')
  })

  it('returns strength "soft" for 9 records', () => {
    const records = Array.from({ length: 9 }, (_, i) => liked(['garlic', 'lemon'], i + 1))
    expect(computePreferenceProfile(records).strength).toBe('soft')
  })

  it('returns strength "full" for exactly 10 records', () => {
    const records = Array.from({ length: 10 }, (_, i) => liked(['garlic', 'lemon'], i + 1))
    expect(computePreferenceProfile(records).strength).toBe('full')
  })

  it('returns strength "full" for 20 records', () => {
    const records = Array.from({ length: 20 }, (_, i) => liked(['garlic', 'lemon'], i + 1))
    expect(computePreferenceProfile(records).strength).toBe('full')
  })

  it('returns empty lists and scores when strength is none', () => {
    const result = computePreferenceProfile([])
    expect(result.preferred).toEqual([])
    expect(result.avoided).toEqual([])
    expect(result.scores).toEqual({})
  })
})

// ─── scoring ──────────────────────────────────────────────────────────────────

describe('computePreferenceProfile — scoring', () => {
  it('scores 1.0 for an ingredient appearing only in liked recipes (3 appearances)', () => {
    const records = [
      liked(['parsley'], 1),
      liked(['parsley'], 2),
      liked(['parsley'], 3),
    ]
    expect(computePreferenceProfile(records).scores['parsley']).toBe(1)
  })

  it('scores -1.0 for an ingredient appearing only in disliked recipes (3 appearances)', () => {
    const records = [
      disliked(['cilantro'], 1),
      disliked(['cilantro'], 2),
      disliked(['cilantro'], 3),
    ]
    expect(computePreferenceProfile(records).scores['cilantro']).toBe(-1)
  })

  it('computes (2 likes − 1 dislike) / 3 ≈ 0.333', () => {
    const records = [
      liked(['basil'], 1),
      liked(['basil'], 2),
      disliked(['basil'], 3),
    ]
    expect(computePreferenceProfile(records).scores['basil']).toBeCloseTo(1 / 3)
  })

  it('excludes ingredients with exactly 0 score', () => {
    const records = [
      liked(['garlic'], 1),
      disliked(['garlic'], 2),
      liked(['lemon'], 3),   // lemon only 1 appearance → also excluded
    ]
    const result = computePreferenceProfile(records)
    expect(result.scores['garlic']).toBeUndefined()
    expect(result.preferred).not.toContain('garlic')
    expect(result.avoided).not.toContain('garlic')
  })

  it('excludes ingredients with only 1 total appearance', () => {
    const records = [
      liked(['garlic', 'ginger'], 1),
      liked(['garlic'], 2),
      liked(['garlic'], 3),
    ]
    const result = computePreferenceProfile(records)
    expect(result.scores['ginger']).toBeUndefined()
    expect(result.scores['garlic']).toBe(1)
  })

  it('normalises ingredient keys to lowercase', () => {
    const records = [
      liked(['Garlic', 'PARSLEY'], 1),
      liked(['garlic', 'parsley'], 2),
      liked(['garlic', 'parsley'], 3),
    ]
    const result = computePreferenceProfile(records)
    expect(result.scores['garlic']).toBeDefined()
    expect(result.scores['parsley']).toBeDefined()
    expect(result.scores['Garlic']).toBeUndefined()
  })

  it('trims whitespace from ingredient keys', () => {
    const records = [
      liked([' lemon ', 'lemon'], 1),
      liked(['lemon'], 2),
      liked(['lemon'], 3),
    ]
    const result = computePreferenceProfile(records)
    expect(result.scores['lemon']).toBe(1)
  })

  it('silently skips empty recipeIngredients arrays', () => {
    const records = [rec(true, [], 1), rec(false, [], 2), rec(true, [], 3)]
    const result = computePreferenceProfile(records)
    expect(result.scores).toEqual({})
  })
})

// ─── list selection ───────────────────────────────────────────────────────────

describe('computePreferenceProfile — list selection', () => {
  it('only populates preferred when all feedback is positive', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      liked(['garlic', 'lemon'], i + 1)
    )
    const result = computePreferenceProfile(records)
    expect(result.preferred.length).toBeGreaterThan(0)
    expect(result.avoided).toEqual([])
  })

  it('only populates avoided when all feedback is negative', () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      disliked(['cilantro', 'blue cheese'], i + 1)
    )
    const result = computePreferenceProfile(records)
    expect(result.avoided.length).toBeGreaterThan(0)
    expect(result.preferred).toEqual([])
  })

  it('caps preferred list at 5 even when more qualify', () => {
    const ings = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const records = Array.from({ length: 10 }, (_, i) => liked(ings, i + 1))
    expect(computePreferenceProfile(records).preferred).toHaveLength(5)
  })

  it('caps avoided list at 5 even when more qualify', () => {
    const ings = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const records = Array.from({ length: 10 }, (_, i) => disliked(ings, i + 1))
    expect(computePreferenceProfile(records).avoided).toHaveLength(5)
  })

  it('preferred contains ingredients with positive scores', () => {
    const records = [
      liked(['parsley', 'parsley'], 1),
      liked(['parsley', 'parsley'], 2),
      disliked(['cilantro', 'cilantro'], 3),
      disliked(['cilantro', 'cilantro'], 4),
      liked(['lemon', 'lemon'], 5),
    ]
    const result = computePreferenceProfile(records)
    expect(result.preferred).toContain('parsley')
    expect(result.preferred).not.toContain('cilantro')
  })

  it('avoided contains ingredients with negative scores', () => {
    const records = [
      liked(['parsley', 'parsley'], 1),
      liked(['parsley', 'parsley'], 2),
      disliked(['cilantro', 'cilantro'], 3),
      disliked(['cilantro', 'cilantro'], 4),
      liked(['lemon', 'lemon'], 5),
    ]
    const result = computePreferenceProfile(records)
    expect(result.avoided).toContain('cilantro')
    expect(result.avoided).not.toContain('parsley')
  })
})

// ─── buildTasteProfileClause ──────────────────────────────────────────────────

describe('buildTasteProfileClause', () => {
  it('returns empty string for strength "none"', () => {
    const result = buildTasteProfileClause({
      preferred: [], avoided: [], scores: {}, strength: 'none',
    })
    expect(result).toBe('')
  })

  it('returns empty string when both lists are empty (even if strength is full)', () => {
    const result = buildTasteProfileClause({
      preferred: [], avoided: [], scores: {}, strength: 'full',
    })
    expect(result).toBe('')
  })

  it('uses softened language for strength "soft"', () => {
    const clause = buildTasteProfileClause({
      preferred: ['garlic'],
      avoided: ['cilantro'],
      scores: {},
      strength: 'soft',
    })
    expect(clause).toContain('starting to show a preference for')
    expect(clause).toContain('garlic')
    expect(clause).toContain('starting to show a preference against')
    expect(clause).toContain('cilantro')
  })

  it('uses "Tends to enjoy / avoid" language for strength "full"', () => {
    const clause = buildTasteProfileClause({
      preferred: ['parsley', 'lemon'],
      avoided: ['blue cheese'],
      scores: {},
      strength: 'full',
    })
    expect(clause).toContain('Tends to enjoy: parsley, lemon')
    expect(clause).toContain('Tends to avoid: blue cheese')
  })

  it('omits the avoided line when avoided is empty (full mode)', () => {
    const clause = buildTasteProfileClause({
      preferred: ['garlic'], avoided: [], scores: {}, strength: 'full',
    })
    expect(clause).toContain('Tends to enjoy')
    expect(clause).not.toContain('avoid')
  })

  it('omits the preferred line when preferred is empty (full mode)', () => {
    const clause = buildTasteProfileClause({
      preferred: [], avoided: ['cilantro'], scores: {}, strength: 'full',
    })
    expect(clause).not.toContain('enjoy')
    expect(clause).toContain('Tends to avoid')
  })

  it('omits the avoided line when avoided is empty (soft mode)', () => {
    const clause = buildTasteProfileClause({
      preferred: ['garlic'], avoided: [], scores: {}, strength: 'soft',
    })
    expect(clause).toContain('preference for')
    expect(clause).not.toContain('preference against')
  })

  it('includes the "learned from history" header in full mode', () => {
    const clause = buildTasteProfileClause({
      preferred: ['garlic'], avoided: [], scores: {}, strength: 'full',
    })
    expect(clause).toContain('User taste profile (learned from their recipe history)')
  })

  it('includes the "early signals" header in soft mode', () => {
    const clause = buildTasteProfileClause({
      preferred: ['garlic'], avoided: [], scores: {}, strength: 'soft',
    })
    expect(clause).toContain('User taste profile')
    expect(clause).toContain('early signals')
  })

  it('ends with double newline so it separates cleanly from the next prompt section', () => {
    const clause = buildTasteProfileClause({
      preferred: ['garlic'], avoided: [], scores: {}, strength: 'full',
    })
    expect(clause).toMatch(/\n\n$/)
  })
})
