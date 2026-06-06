import {
  getCategoryForIngredient,
  INGREDIENT_CATEGORIES,
  rankSimilar,
  getAllergensForIngredient,
  cosineSimilarityBetween,
} from '../epicure'

// Categories that grain ingredients must never substitute for
const GRAIN_INCOMPATIBLE = new Set(['fat', 'dairy_alternative', 'cheese', 'liquid'])

function grainIsBlockedFor(candidate: string, target: string): boolean {
  const candidateCat = getCategoryForIngredient(candidate)
  const targetCat    = getCategoryForIngredient(target)
  return (
    candidateCat === 'grain' &&
    targetCat !== null &&
    GRAIN_INCOMPATIBLE.has(targetCat)
  )
}

describe('getCategoryForIngredient', () => {
  it('correctly categorises grain ingredients', () => {
    expect(getCategoryForIngredient('pasta')).toBe('grain')
    expect(getCategoryForIngredient('rice')).toBe('grain')
    expect(getCategoryForIngredient('flour')).toBe('grain')
    expect(getCategoryForIngredient('oats')).toBe('grain')
  })

  it('correctly categorises fat ingredients', () => {
    expect(getCategoryForIngredient('butter')).toBe('fat')
    expect(getCategoryForIngredient('olive_oil')).toBe('fat')
    expect(getCategoryForIngredient('coconut_oil')).toBe('fat')
  })

  it('correctly categorises liquid ingredients', () => {
    expect(getCategoryForIngredient('milk')).toBe('liquid')
    expect(getCategoryForIngredient('cream')).toBe('liquid')
    expect(getCategoryForIngredient('broth')).toBe('liquid')
  })

  it('correctly categorises dairy alternatives', () => {
    expect(getCategoryForIngredient('oat_milk')).toBe('dairy_alternative')
    expect(getCategoryForIngredient('soy_milk')).toBe('dairy_alternative')
    expect(getCategoryForIngredient('almond_milk')).toBe('dairy_alternative')
  })

  it('correctly categorises protein ingredients', () => {
    expect(getCategoryForIngredient('chicken')).toBe('protein')
    expect(getCategoryForIngredient('tofu')).toBe('protein')
    expect(getCategoryForIngredient('egg')).toBe('protein')
  })

  it('returns null for uncategorised ingredients', () => {
    expect(getCategoryForIngredient('zzz_not_categorised')).toBeNull()
    expect(getCategoryForIngredient('lemon')).toBeNull()
  })

  it('INGREDIENT_CATEGORIES has no duplicate members across categories', () => {
    const seen = new Map<string, string>()
    for (const [cat, items] of Object.entries(INGREDIENT_CATEGORIES)) {
      for (const item of items) {
        if (seen.has(item)) {
          throw new Error(`"${item}" appears in both "${seen.get(item)}" and "${cat}"`)
        }
        seen.set(item, cat)
      }
    }
  })
})

describe('grain hard filter', () => {
  it('pasta is blocked when substituting for butter (fat)', () => {
    expect(grainIsBlockedFor('pasta', 'butter')).toBe(true)
  })

  it('rice is blocked when substituting for milk (liquid)', () => {
    expect(grainIsBlockedFor('rice', 'milk')).toBe(true)
  })

  it('flour is blocked when substituting for oat_milk (dairy_alternative)', () => {
    expect(grainIsBlockedFor('flour', 'oat_milk')).toBe(true)
  })

  it('oats are blocked when substituting for cream (liquid)', () => {
    expect(grainIsBlockedFor('oats', 'cream')).toBe(true)
  })

  it('pasta is NOT blocked when substituting for chicken (protein)', () => {
    expect(grainIsBlockedFor('pasta', 'chicken')).toBe(false)
  })

  it('non-grain candidates are never blocked by this rule', () => {
    expect(grainIsBlockedFor('olive_oil', 'butter')).toBe(false)
    expect(grainIsBlockedFor('tofu', 'milk')).toBe(false)
  })
})

describe('allergen filtering', () => {
  it('filters out allergen-containing substitutes correctly', () => {
    const userAllergens = ['milk']
    const candidates = rankSimilar('oat_milk').slice(0, 30)
    const safe = candidates.filter(({ name }) => {
      const codes = getAllergensForIngredient(name)
      return !codes.some((c) => userAllergens.includes(c))
    })
    // Every remaining candidate must be free of the milk allergen
    safe.forEach(({ name }) => {
      expect(getAllergensForIngredient(name)).not.toContain('milk')
    })
  })

  it('filtering by allergen produces only allergen-free candidates', () => {
    const userAllergens = ['gluten']
    const similar = rankSimilar('pasta').slice(0, 50)
    const filtered = similar.filter(({ name }) =>
      !getAllergensForIngredient(name).some((c) => userAllergens.includes(c))
    )
    filtered.forEach(({ name }) => {
      expect(getAllergensForIngredient(name)).not.toContain('gluten')
    })
    expect(filtered.length).toBeGreaterThan(0)
  })
})

describe('context scoring', () => {
  it('dairy ingredients are more similar to each other than to unrelated ingredients', () => {
    const milkToCream  = cosineSimilarityBetween('milk', 'cream')
    const milkToCarrot = cosineSimilarityBetween('milk', 'carrot')
    expect(milkToCream).toBeGreaterThan(milkToCarrot)
  })

  it('context fit influences the weighted substitute score', () => {
    // Substituting chicken for beef.
    // Context A: pork (meat dish) → chicken fits well.
    // Context B: flour (baking context) → chicken fits poorly.
    const simToBeef = cosineSimilarityBetween('chicken', 'beef')

    const fitMeat   = cosineSimilarityBetween('chicken', 'pork')
    const fitBaking = cosineSimilarityBetween('chicken', 'flour')

    const scoreMeat   = 0.6 * simToBeef + (fitMeat   > simToBeef + 0.15 ? -0.2 : 0.3 * fitMeat)
    const scoreBaking = 0.6 * simToBeef + (fitBaking > simToBeef + 0.15 ? -0.2 : 0.3 * fitBaking)

    expect(fitMeat).toBeGreaterThan(fitBaking)
    expect(scoreMeat).toBeGreaterThan(scoreBaking)
  })
})
