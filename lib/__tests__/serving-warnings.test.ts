import { toGrams, computeServingWarnings } from '../serving-warnings'
import type { IngredientItem } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ing(
  name: string,
  opts: Partial<Pick<IngredientItem, 'quantity' | 'unit' | 'displayName'>> = {},
): IngredientItem {
  return {
    id: 'test-id',
    name,
    area: 'fridge',
    addedAt: '2026-05-01',
    ...opts,
  }
}

// ─── toGrams ──────────────────────────────────────────────────────────────────

describe('toGrams', () => {
  it('returns the value unchanged for grams', () => {
    expect(toGrams('500', 'grams')).toBe(500)
  })

  it('multiplies by 1000 for kg', () => {
    expect(toGrams('1.5', 'kg')).toBe(1500)
  })

  it('returns null for pieces', () => {
    expect(toGrams('3', 'pieces')).toBeNull()
  })

  it('returns null for ml', () => {
    expect(toGrams('250', 'ml')).toBeNull()
  })

  it('returns null for litres', () => {
    expect(toGrams('1', 'litres')).toBeNull()
  })

  it('returns null for tbsp', () => {
    expect(toGrams('2', 'tbsp')).toBeNull()
  })

  it('returns null for a non-numeric quantity string', () => {
    expect(toGrams('lots', 'grams')).toBeNull()
  })

  it('handles decimal grams correctly', () => {
    expect(toGrams('0.5', 'grams')).toBe(0.5)
  })

  it('handles decimal kg correctly', () => {
    expect(toGrams('0.25', 'kg')).toBe(250)
  })
})

// ─── computeServingWarnings — threshold ───────────────────────────────────────

describe('computeServingWarnings — threshold', () => {
  it('returns no warnings when servings is 1', () => {
    const items = [ing('chicken', { quantity: '1', unit: 'pieces' })]
    expect(computeServingWarnings(items, 1)).toEqual([])
  })

  it('returns no warnings when servings is 2 (the default)', () => {
    const items = [ing('chicken', { quantity: '1', unit: 'pieces' })]
    expect(computeServingWarnings(items, 2)).toEqual([])
  })

  it('fires warnings at servings 3', () => {
    const items = [ing('chicken', { quantity: '1', unit: 'pieces' })]
    expect(computeServingWarnings(items, 3)).toContain('Chicken')
  })
})

// ─── computeServingWarnings — protein (pieces) ────────────────────────────────

describe('computeServingWarnings — protein (pieces)', () => {
  it('warns when pieces < servings', () => {
    const items = [ing('chicken', { quantity: '2', unit: 'pieces' })]
    expect(computeServingWarnings(items, 3)).toContain('Chicken')
  })

  it('does not warn when pieces === servings', () => {
    const items = [ing('chicken', { quantity: '4', unit: 'pieces' })]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })

  it('does not warn when pieces > servings', () => {
    const items = [ing('chicken', { quantity: '6', unit: 'pieces' })]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })

  it('warns for other protein types (egg)', () => {
    const items = [ing('egg', { quantity: '2', unit: 'pieces' })]
    expect(computeServingWarnings(items, 4)).toContain('Egg')
  })

  it('warns for salmon in pieces', () => {
    const items = [ing('salmon', { quantity: '1', unit: 'pieces' })]
    expect(computeServingWarnings(items, 3)).toContain('Salmon')
  })
})

// ─── computeServingWarnings — protein (grams) ────────────────────────────────

describe('computeServingWarnings — protein (grams)', () => {
  it('warns when grams < servings × 150', () => {
    // 3 servings × 150g = 450g needed; 300g provided → warn
    const items = [ing('chicken', { quantity: '300', unit: 'grams' })]
    expect(computeServingWarnings(items, 3)).toContain('Chicken')
  })

  it('does not warn when grams >= servings × 150', () => {
    const items = [ing('chicken', { quantity: '500', unit: 'grams' })]
    expect(computeServingWarnings(items, 3)).toEqual([])
  })

  it('converts kg to grams before comparing', () => {
    // 0.2 kg = 200g; 3 × 150 = 450g needed → warn
    const items = [ing('beef', { quantity: '0.2', unit: 'kg' })]
    expect(computeServingWarnings(items, 3)).toContain('Beef')
  })

  it('does not warn for unconvertible units (ml)', () => {
    const items = [ing('chicken', { quantity: '200', unit: 'ml' })]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })
})

// ─── computeServingWarnings — grains ─────────────────────────────────────────

describe('computeServingWarnings — grains', () => {
  it('warns when grams < servings × 80', () => {
    // 4 × 80 = 320g needed; 200g provided
    const items = [ing('rice', { quantity: '200', unit: 'grams' })]
    expect(computeServingWarnings(items, 4)).toContain('Rice')
  })

  it('does not warn when grams >= servings × 80', () => {
    const items = [ing('pasta', { quantity: '400', unit: 'grams' })]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })

  it('converts kg for grains', () => {
    // 0.1 kg = 100g; 4 × 80 = 320g needed → warn
    const items = [ing('rice', { quantity: '0.1', unit: 'kg' })]
    expect(computeServingWarnings(items, 4)).toContain('Rice')
  })

  it('does not warn for grains measured in pieces (no comparison possible)', () => {
    const items = [ing('rice', { quantity: '2', unit: 'pieces' })]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })
})

// ─── computeServingWarnings — vegetables ─────────────────────────────────────

describe('computeServingWarnings — vegetables', () => {
  it('warns when grams < servings × 100', () => {
    // 4 × 100 = 400g needed; 250g provided
    const items = [ing('broccoli', { quantity: '250', unit: 'grams' })]
    expect(computeServingWarnings(items, 4)).toContain('Broccoli')
  })

  it('does not warn when grams >= servings × 100', () => {
    const items = [ing('spinach', { quantity: '500', unit: 'grams' })]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })
})

// ─── computeServingWarnings — edge cases ─────────────────────────────────────

describe('computeServingWarnings — edge cases', () => {
  it('skips ingredients with no quantity set', () => {
    const items = [ing('chicken')]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })

  it('skips ingredients not in any category', () => {
    const items = [ing('olive_oil', { quantity: '50', unit: 'grams' })]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })

  it('uses displayName in the warning label when set', () => {
    const items = [ing('chicken', { quantity: '1', unit: 'pieces', displayName: 'Chicken Thighs' })]
    expect(computeServingWarnings(items, 4)).toContain('Chicken Thighs')
  })

  it('falls back to a formatted name when displayName is absent', () => {
    const items = [ing('sweet_potato', { quantity: '100', unit: 'grams' })]
    const warnings = computeServingWarnings(items, 4)
    expect(warnings[0]).toBe('Sweet Potato')
  })

  it('returns multiple warnings when several ingredients are short', () => {
    const items = [
      ing('chicken', { quantity: '1', unit: 'pieces' }),
      ing('rice', { quantity: '100', unit: 'grams' }),
    ]
    const warnings = computeServingWarnings(items, 4)
    expect(warnings).toHaveLength(2)
  })

  it('returns an empty array when all ingredients are sufficient', () => {
    const items = [
      ing('chicken', { quantity: '10', unit: 'pieces' }),
      ing('rice', { quantity: '1', unit: 'kg' }),
    ]
    expect(computeServingWarnings(items, 4)).toEqual([])
  })
})
