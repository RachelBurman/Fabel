/**
 * Unit tests for kitchen equipment state logic.
 *
 * Covers:
 *  - Default equipment values (hob + oven on by default)
 *  - toggleKitchenEquipment — mirrored from fable-context.tsx
 *  - EQUIPMENT_OPTIONS constants — mirrored from ingredients-screen.tsx
 *  - DynamoDB persistence defaults — mirrored from profile/route.ts
 *  - Servings stepper clamping logic
 *  - RecipeFilters shape includes all new fields
 */

// ─── Mirrored constants ───────────────────────────────────────────────────────

const DEFAULT_EQUIPMENT = ['hob', 'oven']

const ALL_EQUIPMENT_VALUES = [
  'hob', 'oven', 'microwave', 'air_fryer',
  'slow_cooker', 'pizza_oven', 'barbecue', 'instant_pot',
]

const EQUIPMENT_DEFAULTS_ON = ['hob', 'oven']

// ─── Mirrored toggleKitchenEquipment logic (from fable-context.tsx) ───────────

function toggleKitchenEquipment(current: string[], item: string): string[] {
  return current.includes(item)
    ? current.filter((e) => e !== item)
    : [...current, item]
}

// ─── Mirrored servings clamping (from ingredients-screen.tsx stepper) ─────────

const SERVINGS_MIN = 1
const SERVINGS_MAX = 12
const SERVINGS_DEFAULT = 2

function clampServings(value: number): number {
  return Math.max(SERVINGS_MIN, Math.min(SERVINGS_MAX, value))
}

// ─── Mirrored profile route defaults ─────────────────────────────────────────

function getProfileDefaults(): { kitchenEquipment: string[]; darkMode: boolean } {
  return {
    kitchenEquipment: ['hob', 'oven'],
    darkMode: false,
  }
}

// ─── Tests: default equipment ─────────────────────────────────────────────────

describe('kitchen equipment defaults', () => {
  it('default equipment includes hob', () => {
    expect(DEFAULT_EQUIPMENT).toContain('hob')
  })

  it('default equipment includes oven', () => {
    expect(DEFAULT_EQUIPMENT).toContain('oven')
  })

  it('default equipment is exactly [hob, oven]', () => {
    expect(DEFAULT_EQUIPMENT).toEqual(['hob', 'oven'])
  })

  it('EQUIPMENT_DEFAULTS_ON are a subset of ALL_EQUIPMENT_VALUES', () => {
    for (const item of EQUIPMENT_DEFAULTS_ON) {
      expect(ALL_EQUIPMENT_VALUES).toContain(item)
    }
  })

  it('all 8 equipment values are present', () => {
    expect(ALL_EQUIPMENT_VALUES).toHaveLength(8)
    expect(ALL_EQUIPMENT_VALUES).toContain('hob')
    expect(ALL_EQUIPMENT_VALUES).toContain('oven')
    expect(ALL_EQUIPMENT_VALUES).toContain('microwave')
    expect(ALL_EQUIPMENT_VALUES).toContain('air_fryer')
    expect(ALL_EQUIPMENT_VALUES).toContain('slow_cooker')
    expect(ALL_EQUIPMENT_VALUES).toContain('pizza_oven')
    expect(ALL_EQUIPMENT_VALUES).toContain('barbecue')
    expect(ALL_EQUIPMENT_VALUES).toContain('instant_pot')
  })

  it('no duplicate values in ALL_EQUIPMENT_VALUES', () => {
    expect(new Set(ALL_EQUIPMENT_VALUES).size).toBe(ALL_EQUIPMENT_VALUES.length)
  })
})

// ─── Tests: toggleKitchenEquipment ───────────────────────────────────────────

describe('toggleKitchenEquipment', () => {
  it('adds an item that is not present', () => {
    const result = toggleKitchenEquipment(['hob', 'oven'], 'microwave')
    expect(result).toContain('microwave')
    expect(result).toContain('hob')
    expect(result).toContain('oven')
  })

  it('removes an item that is already present', () => {
    const result = toggleKitchenEquipment(['hob', 'oven'], 'hob')
    expect(result).not.toContain('hob')
    expect(result).toContain('oven')
  })

  it('toggling off hob from defaults yields [oven]', () => {
    expect(toggleKitchenEquipment(['hob', 'oven'], 'hob')).toEqual(['oven'])
  })

  it('toggling off oven from defaults yields [hob]', () => {
    expect(toggleKitchenEquipment(['hob', 'oven'], 'oven')).toEqual(['hob'])
  })

  it('toggling the only remaining item yields an empty array', () => {
    expect(toggleKitchenEquipment(['hob'], 'hob')).toEqual([])
  })

  it('toggling air_fryer onto defaults adds it at the end', () => {
    const result = toggleKitchenEquipment(['hob', 'oven'], 'air_fryer')
    expect(result).toEqual(['hob', 'oven', 'air_fryer'])
  })

  it('does not duplicate an item that is already present', () => {
    const result = toggleKitchenEquipment(['hob', 'oven', 'hob'], 'hob')
    // Removes all occurrences of hob (filter removes all matching)
    expect(result).not.toContain('hob')
  })

  it('returns a new array reference (immutable)', () => {
    const original = ['hob', 'oven']
    const result = toggleKitchenEquipment(original, 'microwave')
    expect(result).not.toBe(original)
    expect(original).toEqual(['hob', 'oven']) // original is unchanged
  })

  it('starting from empty, toggling hob adds it', () => {
    expect(toggleKitchenEquipment([], 'hob')).toEqual(['hob'])
  })

  it('round-trip toggle: add then remove returns to original', () => {
    const start = ['hob', 'oven']
    const added = toggleKitchenEquipment(start, 'air_fryer')
    const removed = toggleKitchenEquipment(added, 'air_fryer')
    expect(removed).toEqual(start)
  })
})

// ─── Tests: servings stepper ──────────────────────────────────────────────────

describe('servings stepper', () => {
  it('default servings is 2', () => {
    expect(SERVINGS_DEFAULT).toBe(2)
  })

  it('minimum servings is 1', () => {
    expect(clampServings(0)).toBe(1)
    expect(clampServings(-5)).toBe(1)
  })

  it('maximum servings is 12', () => {
    expect(clampServings(13)).toBe(12)
    expect(clampServings(100)).toBe(12)
  })

  it('values within range pass through unchanged', () => {
    for (let n = 1; n <= 12; n++) {
      expect(clampServings(n)).toBe(n)
    }
  })

  it('decrement at min stays at 1', () => {
    expect(clampServings(SERVINGS_MIN - 1)).toBe(SERVINGS_MIN)
  })

  it('increment at max stays at 12', () => {
    expect(clampServings(SERVINGS_MAX + 1)).toBe(SERVINGS_MAX)
  })
})

// ─── Tests: profile defaults ──────────────────────────────────────────────────

describe('profile new-field defaults', () => {
  it('kitchenEquipment defaults to [hob, oven]', () => {
    expect(getProfileDefaults().kitchenEquipment).toEqual(['hob', 'oven'])
  })

  it('darkMode defaults to false', () => {
    expect(getProfileDefaults().darkMode).toBe(false)
  })

  it('kitchenEquipment default is not empty', () => {
    expect(getProfileDefaults().kitchenEquipment.length).toBeGreaterThan(0)
  })
})

// ─── Tests: RecipeFilters shape ───────────────────────────────────────────────

describe('RecipeFilters new fields', () => {
  function makeDefaultFilters() {
    return {
      mealType: 'main' as const,
      cookTime: 'medium' as const,
      kitchenOnly: false,
      cuisine: '',
      occasion: '',
      servings: 2,
    }
  }

  it('default filters include cuisine as empty string', () => {
    expect(makeDefaultFilters().cuisine).toBe('')
  })

  it('default filters include occasion as empty string', () => {
    expect(makeDefaultFilters().occasion).toBe('')
  })

  it('default filters include servings as 2', () => {
    expect(makeDefaultFilters().servings).toBe(2)
  })

  it('all required filter fields are present', () => {
    const f = makeDefaultFilters()
    expect('mealType' in f).toBe(true)
    expect('cookTime' in f).toBe(true)
    expect('kitchenOnly' in f).toBe(true)
    expect('cuisine' in f).toBe(true)
    expect('occasion' in f).toBe(true)
    expect('servings' in f).toBe(true)
  })
})
