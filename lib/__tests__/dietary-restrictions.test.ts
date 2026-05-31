/**
 * Tests for the lactose mode feature, diet presets, substitution threshold,
 * DynamoDB loading gate, and allergen-screen header subtitle.
 *
 * All tests are pure logic — no DOM, no React, no network calls.
 */

import { DIET_PRESETS } from '../types'
import { getAllergensForIngredient } from '../epicure'

// ─── Logic mirrored from fable-context.tsx ────────────────────────────────────

function computeEffectiveAllergens(
  allergens: string[],
  lactoseIntolerant: boolean,
  lactoseMode: 'include' | 'exclude'
): string[] {
  if (
    lactoseIntolerant &&
    lactoseMode === 'exclude' &&
    !allergens.includes('milk')
  ) {
    return [...allergens, 'milk']
  }
  return allergens
}

function computeEffectiveCustomAllergens(
  customAllergens: string[],
  activePresets: string[]
): string[] {
  const presetIngredients = activePresets.flatMap(
    (id) => DIET_PRESETS[id]?.ingredients ?? []
  )
  return [...new Set([...customAllergens, ...presetIngredients])]
}

// ─── Logic mirrored from allergen-screen.tsx header subtitle ──────────────────

function computeHeaderSubtitle(
  allergenCount: number,
  activePresets: string[],
  lactoseIntolerant: boolean
): string {
  const activePresetLabels = activePresets.map(
    (id) => DIET_PRESETS[id]?.label ?? id
  )
  const parts: string[] = []
  if (activePresetLabels.length > 0) parts.push(activePresetLabels.join(', '))
  if (lactoseIntolerant) parts.push('Lactose intolerance')
  if (allergenCount > 0)
    parts.push(`${allergenCount} allergen${allergenCount > 1 ? 's' : ''}`)
  if (parts.length === 0) return 'No restrictions selected'
  return `${parts.join(' + ')} active`
}

// ─── Logic mirrored from substitutes-screen.tsx threshold check ──────────────

const SUBSTITUTE_THRESHOLD = 45

function acceptSubstitute(combinedScore: number): boolean {
  return combinedScore >= SUBSTITUTE_THRESHOLD
}

// ─── Logic mirrored from fable-context.tsx DynamoDB loading gate ─────────────

function shouldLoadProfile(profile: {
  allergens?: unknown
  ingredients?: unknown
  activePresets?: unknown
  lactoseIntolerant?: unknown
}): boolean {
  return (
    profile.allergens !== undefined ||
    profile.ingredients !== undefined ||
    profile.activePresets !== undefined ||
    profile.lactoseIntolerant !== undefined
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('lactose mode — effectiveAllergens', () => {
  it('adds milk when lactoseIntolerant is true and mode is exclude', () => {
    expect(computeEffectiveAllergens([], true, 'exclude')).toContain('milk')
  })

  it('does NOT add milk when lactoseIntolerant is true and mode is include', () => {
    expect(computeEffectiveAllergens([], true, 'include')).not.toContain('milk')
  })

  it('does NOT add milk when not lactoseIntolerant regardless of mode', () => {
    expect(computeEffectiveAllergens([], false, 'exclude')).not.toContain('milk')
    expect(computeEffectiveAllergens([], false, 'include')).not.toContain('milk')
  })

  it('does not duplicate milk if already explicitly set as allergen', () => {
    const result = computeEffectiveAllergens(['milk'], true, 'exclude')
    expect(result.filter((a) => a === 'milk')).toHaveLength(1)
  })

  it('preserves all other allergens unchanged in include mode', () => {
    const result = computeEffectiveAllergens(['gluten', 'eggs'], true, 'include')
    expect(result).toContain('gluten')
    expect(result).toContain('eggs')
    expect(result).not.toContain('milk')
  })

  it('preserves all other allergens unchanged in exclude mode', () => {
    const result = computeEffectiveAllergens(['gluten'], true, 'exclude')
    expect(result).toContain('gluten')
    expect(result).toContain('milk')
  })
})

describe('diet preset exclusions', () => {
  it('vegan preset excludes dairy, meat, and eggs', () => {
    const excluded = computeEffectiveCustomAllergens([], ['vegan'])
    expect(excluded).toContain('milk')
    expect(excluded).toContain('butter')
    expect(excluded).toContain('cream')
    expect(excluded).toContain('chicken')
    expect(excluded).toContain('beef')
    expect(excluded).toContain('egg')
  })

  it('vegetarian preset excludes meat but not dairy', () => {
    const excluded = computeEffectiveCustomAllergens([], ['vegetarian'])
    expect(excluded).toContain('chicken')
    expect(excluded).toContain('beef')
    expect(excluded).not.toContain('milk')
    expect(excluded).not.toContain('butter')
    expect(excluded).not.toContain('egg')
  })

  it('keto preset excludes high-carb items', () => {
    const excluded = computeEffectiveCustomAllergens([], ['keto'])
    expect(excluded).toContain('pasta')
    expect(excluded).toContain('rice')
    expect(excluded).toContain('sugar')
    expect(excluded).toContain('potato')
    expect(excluded).not.toContain('chicken')
    expect(excluded).not.toContain('butter')
  })

  it('low_fodmap preset excludes FODMAP triggers', () => {
    const excluded = computeEffectiveCustomAllergens([], ['low_fodmap'])
    expect(excluded).toContain('garlic')
    expect(excluded).toContain('onion')
    expect(excluded).toContain('honey')
    expect(excluded).toContain('milk')
    expect(excluded).not.toContain('chicken')
  })

  it('stacking presets merges without duplicates', () => {
    const excluded = computeEffectiveCustomAllergens([], ['vegan', 'keto'])
    const milkEntries = excluded.filter((i) => i === 'milk')
    expect(milkEntries).toHaveLength(1)
    expect(excluded).toContain('chicken')
    expect(excluded).toContain('pasta')
  })

  it('custom allergens are merged with preset exclusions', () => {
    const excluded = computeEffectiveCustomAllergens(
      ['anchovy', 'sardine'],
      ['vegetarian']
    )
    expect(excluded).toContain('anchovy')
    expect(excluded).toContain('sardine')
    expect(excluded).toContain('chicken')
  })

  it('unknown preset ID is handled gracefully — returns empty, no throw', () => {
    expect(() =>
      computeEffectiveCustomAllergens([], ['unknown_preset'])
    ).not.toThrow()
    const result = computeEffectiveCustomAllergens([], ['unknown_preset'])
    expect(result).toHaveLength(0)
  })

  it('empty activePresets returns only customAllergens', () => {
    const result = computeEffectiveCustomAllergens(['peanuts'], [])
    expect(result).toEqual(['peanuts'])
  })
})

describe('lactose mode + vegan preset interaction', () => {
  it('vegan preset independently excludes dairy via customAllergens', () => {
    const customExcluded = computeEffectiveCustomAllergens([], ['vegan'])
    expect(customExcluded).toContain('milk')
    expect(customExcluded).toContain('cream')
    expect(customExcluded).toContain('butter')
  })

  it('include mode does not add milk to EU allergens even when vegan is active', () => {
    const allergens = computeEffectiveAllergens([], true, 'include')
    expect(allergens).not.toContain('milk')
    // Dairy is still excluded via the vegan preset in customAllergens, separately
  })

  it('exclude mode adds milk to EU allergen set regardless of presets', () => {
    const allergens = computeEffectiveAllergens(['gluten'], true, 'exclude')
    expect(allergens).toContain('milk')
    expect(allergens).toContain('gluten')
  })
})

describe('substitution threshold (45%)', () => {
  it('accepts a substitute at exactly 45', () => {
    expect(acceptSubstitute(45)).toBe(true)
  })

  it('accepts a substitute well above 45', () => {
    expect(acceptSubstitute(82)).toBe(true)
    expect(acceptSubstitute(100)).toBe(true)
  })

  it('rejects a substitute at 44', () => {
    expect(acceptSubstitute(44)).toBe(false)
  })

  it('rejects a substitute at 0', () => {
    expect(acceptSubstitute(0)).toBe(false)
  })

  it('rejects 44.9 (threshold is not inclusive below 45)', () => {
    expect(acceptSubstitute(44.9)).toBe(false)
  })

  it('accepts 45.0 (boundary is inclusive)', () => {
    expect(acceptSubstitute(45.0)).toBe(true)
  })
})

describe('DynamoDB profile loading gate', () => {
  it('loads when allergens field is present (even empty array)', () => {
    expect(shouldLoadProfile({ allergens: [] })).toBe(true)
  })

  it('loads when ingredients field is present', () => {
    expect(shouldLoadProfile({ ingredients: [] })).toBe(true)
  })

  it('loads when only activePresets is present', () => {
    expect(shouldLoadProfile({ activePresets: ['vegan'] })).toBe(true)
  })

  it('loads when only lactoseIntolerant is present', () => {
    expect(shouldLoadProfile({ lactoseIntolerant: true })).toBe(true)
  })

  it('loads when lactoseIntolerant is explicitly false', () => {
    // false !== undefined so the profile should be restored
    expect(shouldLoadProfile({ lactoseIntolerant: false })).toBe(true)
  })

  it('loads when only activePresets is an empty array', () => {
    expect(shouldLoadProfile({ activePresets: [] })).toBe(true)
  })

  it('does NOT load when all relevant fields are absent', () => {
    expect(shouldLoadProfile({})).toBe(false)
  })

  it('previous bug case: preset-only profile now loads correctly', () => {
    // A user who only configured a diet preset (no allergens/ingredients)
    // used to be ignored because the gate only checked allergens + ingredients
    expect(shouldLoadProfile({ activePresets: ['vegetarian'] })).toBe(true)
  })
})

describe('allergen-screen header subtitle', () => {
  it('shows "No restrictions selected" when nothing is active', () => {
    expect(computeHeaderSubtitle(0, [], false)).toBe('No restrictions selected')
  })

  it('shows preset label when only a preset is active', () => {
    expect(computeHeaderSubtitle(0, ['vegan'], false)).toBe('Vegan active')
  })

  it('shows lactose when only lactose intolerance is active', () => {
    expect(computeHeaderSubtitle(0, [], true)).toBe('Lactose intolerance active')
  })

  it('shows singular allergen count', () => {
    expect(computeHeaderSubtitle(1, [], false)).toBe('1 allergen active')
  })

  it('shows plural allergen count', () => {
    expect(computeHeaderSubtitle(3, [], false)).toBe('3 allergens active')
  })

  it('combines preset + lactose + allergens', () => {
    expect(computeHeaderSubtitle(3, ['vegan'], true)).toBe(
      'Vegan + Lactose intolerance + 3 allergens active'
    )
  })

  it('combines preset and allergens without lactose', () => {
    expect(computeHeaderSubtitle(1, ['keto'], false)).toBe('Keto + 1 allergen active')
  })

  it('combines multiple presets', () => {
    expect(computeHeaderSubtitle(0, ['vegetarian', 'keto'], false)).toBe(
      'Vegetarian, Keto active'
    )
  })

  it('does not include inactive preset labels', () => {
    const result = computeHeaderSubtitle(0, ['vegetarian'], false)
    expect(result).not.toContain('Vegan')
    expect(result).toContain('Vegetarian')
  })
})

describe('allergen data — dairy ingredients have milk allergen code', () => {
  it('milk has milk allergen code', () => {
    expect(getAllergensForIngredient('milk')).toContain('milk')
  })

  it('butter has milk allergen code (shows 🥛 in kitchen)', () => {
    expect(getAllergensForIngredient('butter')).toContain('milk')
  })

  it('cream has milk allergen code', () => {
    expect(getAllergensForIngredient('cream')).toContain('milk')
  })

  it('cheese has milk allergen code', () => {
    expect(getAllergensForIngredient('cheese')).toContain('milk')
  })

  it('yogurt has milk allergen code', () => {
    expect(getAllergensForIngredient('yogurt')).toContain('milk')
  })

  it('oat_milk does NOT have milk allergen code (dairy-free)', () => {
    expect(getAllergensForIngredient('oat_milk')).not.toContain('milk')
  })

  it('chicken has no allergen codes', () => {
    expect(getAllergensForIngredient('chicken')).toHaveLength(0)
  })
})
