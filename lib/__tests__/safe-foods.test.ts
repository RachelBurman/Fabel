import {
  buildSafeSet,
  findInSafeSet,
  wordVariants,
  isSafe,
  validateSafeFoods,
  LIQUID_TERMS,
  SALT_TERMS,
} from '../safe-foods'

// ─── buildSafeSet ─────────────────────────────────────────────────────────────

describe('buildSafeSet', () => {
  it('converts underscores to spaces', () => {
    const s = buildSafeSet(['olive_oil'])
    expect(s.has('olive oil')).toBe(true)
    expect(s.has('olive_oil')).toBe(false)
  })

  it('lowercases all entries', () => {
    const s = buildSafeSet(['CHICKEN', 'Garlic'])
    expect(s.has('chicken')).toBe(true)
    expect(s.has('garlic')).toBe(true)
  })

  it('trims whitespace', () => {
    const s = buildSafeSet([' salmon '])
    expect(s.has('salmon')).toBe(true)
  })

  it('handles an empty list', () => {
    expect(buildSafeSet([])).toEqual(new Set())
  })
})

// ─── findInSafeSet ────────────────────────────────────────────────────────────

describe('findInSafeSet', () => {
  it('finds an exact whole-word match', () => {
    const s = new Set(['salt', 'garlic'])
    expect(findInSafeSet(s, ['salt'])).toEqual(['salt'])
  })

  it('matches the term anywhere in a safe entry (whole-word)', () => {
    const s = new Set(['sea salt'])
    expect(findInSafeSet(s, ['salt'])).toEqual(['sea salt'])
  })

  it('does not match a partial substring', () => {
    const s = new Set(['malt'])
    expect(findInSafeSet(s, ['salt'])).toEqual([])
  })

  it('returns multiple matching entries', () => {
    const s = new Set(['sea salt', 'rock salt', 'pepper'])
    const found = findInSafeSet(s, ['salt'])
    expect(found).toHaveLength(2)
    expect(found).toContain('sea salt')
    expect(found).toContain('rock salt')
  })

  it('returns empty array when no terms match', () => {
    const s = new Set(['chicken', 'garlic'])
    expect(findInSafeSet(s, ['water', 'broth'])).toEqual([])
  })

  it('is case-insensitive', () => {
    const s = new Set(['Sea Salt'])
    expect(findInSafeSet(s, ['salt'])).toEqual(['Sea Salt'])
  })
})

// ─── wordVariants ─────────────────────────────────────────────────────────────

describe('wordVariants', () => {
  it('always includes the original word', () => {
    expect(wordVariants('garlic')).toContain('garlic')
  })

  it('generates singular from -ies plural', () => {
    expect(wordVariants('blueberries')).toContain('blueberry')
  })

  it('generates singular from -ves plural (leaves → leaf)', () => {
    expect(wordVariants('leaves')).toContain('leaf')
  })

  it('generates form without -es suffix', () => {
    expect(wordVariants('peaches')).toContain('peach')
  })

  it('generates form without trailing -s', () => {
    expect(wordVariants('carrots')).toContain('carrot')
  })

  it('does not strip -ss endings', () => {
    const variants = wordVariants('grass')
    expect(variants).not.toContain('gras')
  })
})

// ─── isSafe — stage 1: universal basics ──────────────────────────────────────

describe('isSafe — universal basics', () => {
  const emptySet = new Set<string>()

  it('always passes "water" regardless of safe list', () => {
    expect(isSafe('water', emptySet, [])).toBe(true)
  })

  it('always passes "ice" regardless of safe list', () => {
    expect(isSafe('ice', emptySet, [])).toBe(true)
  })

  it('is case-insensitive for universals', () => {
    expect(isSafe('Water', emptySet, [])).toBe(true)
    expect(isSafe('WATER', emptySet, [])).toBe(true)
  })
})

// ─── isSafe — stage 2: special placeholders ──────────────────────────────────

describe('isSafe — special placeholders', () => {
  const emptySet = new Set<string>()

  it('passes "liquid of choice"', () => {
    expect(isSafe('liquid of choice', emptySet, [])).toBe(true)
  })

  it('passes "seasoning of choice"', () => {
    expect(isSafe('seasoning of choice', emptySet, [])).toBe(true)
  })
})

// ─── isSafe — stage 3: salt family ───────────────────────────────────────────

describe('isSafe — salt family', () => {
  it('passes "salt" when user has "sea salt"', () => {
    const safeSet = new Set(['sea salt'])
    const safeSalts = findInSafeSet(safeSet, SALT_TERMS)
    expect(isSafe('salt', safeSet, safeSalts)).toBe(true)
  })

  it('passes "sea salt" when user has "salt"', () => {
    const safeSet = new Set(['salt'])
    const safeSalts = findInSafeSet(safeSet, SALT_TERMS)
    expect(isSafe('sea salt', safeSet, safeSalts)).toBe(true)
  })

  it('passes "kosher salt" when any salt is in the safe list', () => {
    const safeSet = new Set(['rock salt'])
    const safeSalts = findInSafeSet(safeSet, SALT_TERMS)
    expect(isSafe('kosher salt', safeSet, safeSalts)).toBe(true)
  })

  it('blocks salt when safe list has no salt at all', () => {
    const safeSet = new Set(['chicken'])
    expect(isSafe('salt', safeSet, [])).toBe(false)
  })
})

// ─── isSafe — stage 4: exact match ───────────────────────────────────────────

describe('isSafe — exact normalised match', () => {
  it('passes when the normalised name is in the safe set', () => {
    const safeSet = new Set(['chicken'])
    expect(isSafe('chicken', safeSet, [])).toBe(true)
  })

  it('passes "olive oil" as an exact match', () => {
    const safeSet = new Set(['olive oil'])
    expect(isSafe('olive oil', safeSet, [])).toBe(true)
  })

  it('is case-insensitive for exact match', () => {
    const safeSet = new Set(['chicken'])
    expect(isSafe('Chicken', safeSet, [])).toBe(true)
    expect(isSafe('CHICKEN', safeSet, [])).toBe(true)
  })

  it('trims whitespace before matching', () => {
    const safeSet = new Set(['garlic'])
    expect(isSafe('  garlic  ', safeSet, [])).toBe(true)
  })

  it('blocks an ingredient not in the safe set', () => {
    const safeSet = new Set(['chicken'])
    expect(isSafe('cilantro', safeSet, [])).toBe(false)
  })
})

// ─── isSafe — stage 5: whole-phrase ──────────────────────────────────────────

describe('isSafe — whole-phrase match', () => {
  it('passes "chicken broth" when "chicken" is in safe list', () => {
    const safeSet = new Set(['chicken'])
    expect(isSafe('chicken broth', safeSet, [])).toBe(true)
  })

  it('does not match "chick" inside "chicken" (whole-word boundary)', () => {
    const safeSet = new Set(['chick'])
    // "chick" should not match "chicken" due to word boundary
    expect(isSafe('chicken', safeSet, [])).toBe(false)
  })
})

// ─── isSafe — stage 6: core-word with qualifier stripping ────────────────────

describe('isSafe — core-word (qualifier stripping)', () => {
  it('passes "broccoli florets" when "broccoli" is in safe list', () => {
    const safeSet = new Set(['broccoli'])
    expect(isSafe('broccoli florets', safeSet, [])).toBe(true)
  })

  it('passes "minced garlic" when "garlic" is in safe list', () => {
    const safeSet = new Set(['garlic'])
    expect(isSafe('minced garlic', safeSet, [])).toBe(true)
  })

  it('passes "fresh parsley" when "parsley" is in safe list', () => {
    const safeSet = new Set(['parsley'])
    expect(isSafe('fresh parsley', safeSet, [])).toBe(true)
  })

  it('passes "blueberries" when "blueberry" is in safe list (plural variant)', () => {
    const safeSet = new Set(['blueberry'])
    expect(isSafe('blueberries', safeSet, [])).toBe(true)
  })

  it('passes "chicken breast" when "chicken" is in safe list (qualifier stripping)', () => {
    const safeSet = new Set(['chicken'])
    expect(isSafe('chicken breast', safeSet, [])).toBe(true)
  })

  it('blocks an ingredient whose core word is not in the safe list', () => {
    const safeSet = new Set(['parsley'])
    expect(isSafe('fresh cilantro', safeSet, [])).toBe(false)
  })
})

// ─── validateSafeFoods ────────────────────────────────────────────────────────

describe('validateSafeFoods', () => {
  it('removes ingredients not in the safe set', () => {
    const safeSet = new Set(['chicken'])
    const recipe = {
      title: 'Test',
      ingredients: [
        { name: 'chicken', amount: 1, unit: 'piece' },
        { name: 'cilantro', amount: 10, unit: 'grams' },
      ],
    }
    const { recipe: cleaned, violations } = validateSafeFoods(recipe, safeSet, [])
    expect(cleaned.ingredients).toHaveLength(1)
    expect(violations).toContain('cilantro')
  })

  it('keeps safe ingredients and records no violations', () => {
    const safeSet = new Set(['chicken', 'garlic'])
    const recipe = {
      ingredients: [
        { name: 'chicken', amount: 1, unit: 'piece' },
        { name: 'garlic', amount: 2, unit: 'cloves' },
      ],
    }
    const { violations } = validateSafeFoods(recipe, safeSet, [])
    expect(violations).toEqual([])
  })

  it('always keeps water (universal basic)', () => {
    const safeSet = new Set<string>()
    const recipe = {
      ingredients: [{ name: 'water', amount: 200, unit: 'ml' }],
    }
    const { recipe: cleaned, violations } = validateSafeFoods(recipe, safeSet, [])
    expect(cleaned.ingredients).toHaveLength(1)
    expect(violations).toEqual([])
  })

  it('always keeps "liquid of choice" placeholder', () => {
    const safeSet = new Set<string>()
    const recipe = {
      ingredients: [{ name: 'liquid of choice', amount: 100, unit: 'ml' }],
    }
    const { recipe: cleaned } = validateSafeFoods(recipe, safeSet, [])
    expect(cleaned.ingredients).toHaveLength(1)
  })

  it('returns the recipe unchanged when ingredients array is absent', () => {
    const recipe = { title: 'No ingredients' }
    const { recipe: out, violations } = validateSafeFoods(recipe, new Set(), [])
    expect(out).toEqual(recipe)
    expect(violations).toEqual([])
  })

  it('skips non-object ingredient entries without throwing', () => {
    const safeSet = new Set(['chicken'])
    const recipe = { ingredients: ['chicken', null, 42] }
    expect(() => validateSafeFoods(recipe, safeSet, [])).not.toThrow()
  })
})
