/**
 * Unit tests for the prompt clause builders introduced with the four new
 * recipe filters: cuisine, occasion, servings, and kitchen equipment.
 *
 * The clause-building logic is mirrored directly from
 * app/api/generate-recipe/route.ts so that these tests stay pure (no network,
 * no file I/O, no Next.js runtime) and can run in the node Jest environment.
 */

// ─── Mirrored clause builders ─────────────────────────────────────────────────

function buildCuisineClause(cuisine: string): string {
  if (cuisine === 'surprise') {
    return 'Create a dish inspired by a cuisine of your choice — be adventurous and pick something unexpected. '
  }
  if (cuisine) {
    return `Create a ${cuisine}-inspired dish. `
  }
  return ''
}

function buildOccasionClause(occasion: string): string {
  return occasion ? `This is for ${occasion}. ` : ''
}

function buildServingsClause(servings: number): string {
  const noun = servings === 1 ? 'person' : 'people'
  return `Recipe should serve ${servings} ${noun}, scale quantities accordingly. `
}

function buildEquipmentClause(kitchenEquipment: string[]): string {
  if (kitchenEquipment.length === 0) return ''
  return (
    `Only use cooking techniques compatible with: ${kitchenEquipment.join(', ')}. ` +
    `Do not suggest methods requiring equipment not in this list. `
  )
}

// ─── Cuisine clause ───────────────────────────────────────────────────────────

describe('buildCuisineClause', () => {
  it('returns empty string when cuisine is empty', () => {
    expect(buildCuisineClause('')).toBe('')
  })

  it('returns an "inspired dish" clause for a named cuisine', () => {
    expect(buildCuisineClause('italian')).toBe('Create a italian-inspired dish. ')
  })

  it('formats every named cuisine correctly', () => {
    const cuisines = ['chinese', 'korean', 'spanish', 'japanese', 'indian', 'mexican', 'french', 'moroccan', 'thai', 'british', 'greek', 'turkish']
    for (const c of cuisines) {
      expect(buildCuisineClause(c)).toBe(`Create a ${c}-inspired dish. `)
    }
  })

  it('returns the "surprise me" adventurous clause for the surprise value', () => {
    const clause = buildCuisineClause('surprise')
    expect(clause).toContain('cuisine of your choice')
    expect(clause).toContain('adventurous')
    expect(clause).not.toContain('surprise-inspired')
  })

  it('surprise clause does not name a specific cuisine', () => {
    expect(buildCuisineClause('surprise')).not.toMatch(/Create a \w+-inspired/)
  })

  it('clause ends with a trailing space (for safe prompt concatenation)', () => {
    expect(buildCuisineClause('italian').endsWith(' ')).toBe(true)
    expect(buildCuisineClause('surprise').endsWith(' ')).toBe(true)
  })
})

// ─── Occasion clause ─────────────────────────────────────────────────────────

describe('buildOccasionClause', () => {
  it('returns empty string when occasion is empty', () => {
    expect(buildOccasionClause('')).toBe('')
  })

  it('includes the occasion name in the clause', () => {
    expect(buildOccasionClause('Weeknight')).toBe('This is for Weeknight. ')
  })

  it('handles all supported occasions', () => {
    const occasions = [
      'Weeknight', 'Dinner Party', 'Street Food', 'Comfort Food',
      'Packed Lunch', 'Romantic Dinner', 'Meal Prep', 'Celebration',
    ]
    for (const occ of occasions) {
      expect(buildOccasionClause(occ)).toBe(`This is for ${occ}. `)
    }
  })

  it('multi-word occasions are preserved verbatim', () => {
    expect(buildOccasionClause('Dinner Party')).toBe('This is for Dinner Party. ')
    expect(buildOccasionClause('Romantic Dinner')).toBe('This is for Romantic Dinner. ')
  })
})

// ─── Servings clause ──────────────────────────────────────────────────────────

describe('buildServingsClause', () => {
  it('uses "person" for exactly 1 serving', () => {
    expect(buildServingsClause(1)).toContain('1 person')
    expect(buildServingsClause(1)).not.toContain('people')
  })

  it('uses "people" for 2 or more servings', () => {
    expect(buildServingsClause(2)).toContain('2 people')
    expect(buildServingsClause(4)).toContain('4 people')
    expect(buildServingsClause(12)).toContain('12 people')
  })

  it('instructs Claude to scale quantities', () => {
    const clause = buildServingsClause(4)
    expect(clause).toContain('scale quantities accordingly')
  })

  it('default serving size of 2 produces expected clause', () => {
    expect(buildServingsClause(2)).toBe('Recipe should serve 2 people, scale quantities accordingly. ')
  })

  it('handles the full valid range 1–12', () => {
    for (let n = 1; n <= 12; n++) {
      const clause = buildServingsClause(n)
      expect(clause).toContain(String(n))
      expect(clause).toContain('scale quantities accordingly')
    }
  })
})

// ─── Equipment clause ─────────────────────────────────────────────────────────

describe('buildEquipmentClause', () => {
  it('returns empty string when no equipment is selected', () => {
    expect(buildEquipmentClause([])).toBe('')
  })

  it('lists a single piece of equipment', () => {
    const clause = buildEquipmentClause(['hob'])
    expect(clause).toContain('hob')
    expect(clause).toContain('compatible with')
  })

  it('lists multiple pieces of equipment comma-separated', () => {
    const clause = buildEquipmentClause(['hob', 'oven'])
    expect(clause).toContain('hob')
    expect(clause).toContain('oven')
    expect(clause).toContain(',')
  })

  it('includes the "do not suggest" restriction', () => {
    const clause = buildEquipmentClause(['hob'])
    expect(clause).toContain('Do not suggest methods requiring equipment not in this list')
  })

  it('all eight equipment options produce a non-empty clause', () => {
    const allEquipment = ['hob', 'oven', 'microwave', 'air_fryer', 'slow_cooker', 'pizza_oven', 'barbecue', 'instant_pot']
    const clause = buildEquipmentClause(allEquipment)
    for (const item of allEquipment) {
      expect(clause).toContain(item)
    }
  })

  it('default equipment (hob + oven) produces a clause naming both', () => {
    const clause = buildEquipmentClause(['hob', 'oven'])
    expect(clause).toContain('hob')
    expect(clause).toContain('oven')
  })
})

// ─── Combined prompt construction ─────────────────────────────────────────────

describe('combined filter prompt prefix', () => {
  function buildFilterPrefix(opts: {
    cuisine: string
    occasion: string
    servings: number
    equipment: string[]
  }): string {
    return (
      buildCuisineClause(opts.cuisine) +
      buildOccasionClause(opts.occasion) +
      buildServingsClause(opts.servings) +
      buildEquipmentClause(opts.equipment)
    )
  }

  it('produces empty prefix for default filter values with no equipment', () => {
    const prefix = buildFilterPrefix({ cuisine: '', occasion: '', servings: 2, equipment: ['hob', 'oven'] })
    expect(prefix).toContain('2 people')
    expect(prefix).not.toContain('inspired dish')
    expect(prefix).not.toContain('This is for')
  })

  it('includes all four clauses when all filters are set', () => {
    const prefix = buildFilterPrefix({
      cuisine: 'italian',
      occasion: 'Dinner Party',
      servings: 4,
      equipment: ['hob', 'oven'],
    })
    expect(prefix).toContain('italian-inspired')
    expect(prefix).toContain('Dinner Party')
    expect(prefix).toContain('4 people')
    expect(prefix).toContain('hob')
    expect(prefix).toContain('oven')
  })

  it('clauses appear in the correct order: cuisine → occasion → servings → equipment', () => {
    const prefix = buildFilterPrefix({
      cuisine: 'thai',
      occasion: 'Comfort Food',
      servings: 3,
      equipment: ['air_fryer'],
    })
    const cuisineIdx   = prefix.indexOf('thai-inspired')
    const occasionIdx  = prefix.indexOf('Comfort Food')
    const servingsIdx  = prefix.indexOf('3 people')
    const equipmentIdx = prefix.indexOf('air_fryer')

    expect(cuisineIdx).toBeLessThan(occasionIdx)
    expect(occasionIdx).toBeLessThan(servingsIdx)
    expect(servingsIdx).toBeLessThan(equipmentIdx)
  })

  it('omits cuisine clause when cuisine is empty, preserving other clauses', () => {
    const prefix = buildFilterPrefix({
      cuisine: '',
      occasion: 'Weeknight',
      servings: 2,
      equipment: ['hob'],
    })
    expect(prefix).not.toContain('inspired dish')
    expect(prefix).toContain('Weeknight')
    expect(prefix).toContain('2 people')
    expect(prefix).toContain('hob')
  })

  it('omits occasion clause when occasion is empty', () => {
    const prefix = buildFilterPrefix({
      cuisine: 'french',
      occasion: '',
      servings: 2,
      equipment: [],
    })
    expect(prefix).toContain('french-inspired')
    expect(prefix).not.toContain('This is for')
  })
})
