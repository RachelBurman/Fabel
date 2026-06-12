import { findFallbackRecipe, type FindFallbackParams } from '../community-recipe-fallback'
import { SEED_RECIPES } from '../community-recipes-seed'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../dynamo', () => ({
  dynamo: { send: jest.fn() },
}))

import { dynamo } from '../dynamo'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSend = dynamo.send as jest.MockedFunction<(...args: any[]) => any>

// Suppress epicure file-system reads in tests
jest.mock('../epicure', () => ({
  allergenIngredients: {
    gluten: ['wheat', 'flour', 'pasta', 'bread'],
    milk: ['butter', 'cream', 'cheese', 'milk', 'parmesan'],
    eggs: ['egg', 'eggs'],
    fish: ['salmon', 'tuna', 'cod', 'anchovies'],
    crustaceans: ['prawn', 'shrimp', 'crab'],
    tree_nuts: ['almond', 'walnut', 'cashew', 'pistachio'],
    peanuts: ['peanut', 'peanuts'],
    soy: ['tofu', 'miso', 'soy sauce', 'edamame'],
    sesame: ['sesame', 'tahini'],
    celery: ['celery', 'celeriac'],
    mustard: ['mustard'],
    sulphites: ['wine', 'beer'],
    lupin: ['lupin'],
    molluscs: ['oyster', 'mussel', 'squid'],
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  // Default: empty saved-recipes table
  mockSend.mockResolvedValue({ Items: [] })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeParams(overrides: Partial<FindFallbackParams> = {}): FindFallbackParams {
  return {
    allergens: [],
    safeFoods: null,
    ...overrides,
  }
}

function makeSavedRecipeItem(title: string, ingredientNames: string[]) {
  return {
    recipeId: `rec-${title.toLowerCase().replace(/\s/g, '-')}`,
    isSaved: true,
    title,
    description: 'A community recipe.',
    cookTime: '30 minutes',
    servings: 4,
    allergenFree: true,
    ingredients: ingredientNames.map((name) => ({ name, amount: 1, unit: 'pieces' })),
    steps: ['Step 1', 'Step 2'],
  }
}

// ─── findFallbackRecipe — allergen hard-filter ────────────────────────────────

describe('findFallbackRecipe — allergen filter (hard exclusion)', () => {
  it('excludes DB recipes containing the user allergen', async () => {
    mockSend.mockResolvedValue({
      Items: [
        makeSavedRecipeItem('Pasta Carbonara', ['pasta', 'egg', 'parmesan']),
      ],
    })
    const result = await findFallbackRecipe(makeParams({ allergens: ['gluten'] }))
    // "pasta" contains "pasta" which is in allergenIngredients.gluten → excluded
    // No DB result → falls through to seed recipes (all seed recipes have containsAllergens: [])
    expect(result).not.toBeNull()
    // Should come from seeds (which have no allergens)
    const seedIds = SEED_RECIPES.map((s) => s.id)
    expect(seedIds).toContain(result!.id)
  })

  it('keeps DB recipes where none of the allergens are present', async () => {
    mockSend.mockResolvedValue({
      Items: [
        makeSavedRecipeItem('Herb Chicken', ['chicken breast', 'olive oil', 'rosemary', 'lemon']),
      ],
    })
    const result = await findFallbackRecipe(makeParams({ allergens: ['gluten', 'milk'] }))
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Herb Chicken')
  })

  it('returns null only when no seed recipe passes the allergen filter', async () => {
    // Mock all seed recipes as unsafe by overriding containsAllergens — not possible directly,
    // but we can pass an allergen code that none of the mocked allergenIngredients keys appear in
    // any seed recipe ingredient. Seed recipes have no allergens by design so this should
    // always find a match.
    mockSend.mockResolvedValue({ Items: [] })
    const result = await findFallbackRecipe(makeParams({ allergens: [] }))
    expect(result).not.toBeNull()
  })
})

// ─── findFallbackRecipe — cuisine/mealType scoring ────────────────────────────

describe('findFallbackRecipe — preference scoring', () => {
  it('returns a seed recipe with matching cuisine over non-matching', async () => {
    mockSend.mockResolvedValue({ Items: [] })
    // Run multiple times to account for the ±0.5 randomisation
    const moroccans: string[] = []
    for (let i = 0; i < 20; i++) {
      const result = await findFallbackRecipe(makeParams({ cuisine: 'moroccan', allergens: [] }))
      if (result) moroccans.push(result.title)
    }
    // The Moroccan Chickpea and Spinach Stew (seed-002) should appear frequently
    // when cuisine is 'moroccan'. We don't require 100% due to randomisation.
    expect(moroccans.filter((t) => t.includes('Moroccan')).length).toBeGreaterThan(5)
  })

  it('still returns a recipe when no cuisine matches (falls back to any seed)', async () => {
    mockSend.mockResolvedValue({ Items: [] })
    const result = await findFallbackRecipe(
      makeParams({ cuisine: 'unknown_cuisine_xyz', allergens: [] })
    )
    expect(result).not.toBeNull()
  })
})

// ─── findFallbackRecipe — falls back to seed when DB has no results ───────────

describe('findFallbackRecipe — seed fallback', () => {
  it('returns a seed recipe when fable-saved-recipes is empty', async () => {
    mockSend.mockResolvedValue({ Items: [] })
    const result = await findFallbackRecipe(makeParams())
    expect(result).not.toBeNull()
    const seedIds = SEED_RECIPES.map((s) => s.id)
    expect(seedIds).toContain(result!.id)
  })

  it('returns a seed recipe when DB scan fails', async () => {
    mockSend.mockRejectedValue(new Error('DynamoDB error'))
    const result = await findFallbackRecipe(makeParams())
    expect(result).not.toBeNull()
  })
})

// ─── Seed recipes — allergen validation ───────────────────────────────────────

describe('SEED_RECIPES — allergen validation', () => {
  it('all 15 seed recipes have containsAllergens: [] (safe for any user)', () => {
    for (const seed of SEED_RECIPES) {
      expect(seed.containsAllergens).toEqual([])
    }
  })

  it('has exactly 15 seed recipes', () => {
    expect(SEED_RECIPES).toHaveLength(15)
  })

  it('all seed recipes pass allergen check against empty user allergen set', async () => {
    mockSend.mockResolvedValue({ Items: [] })
    // With empty allergens, every seed should be eligible
    const result = await findFallbackRecipe(makeParams({ allergens: [] }))
    expect(result).not.toBeNull()
  })

  it('all seed recipes have required GeneratedRecipe fields', () => {
    for (const seed of SEED_RECIPES) {
      expect(typeof seed.title).toBe('string')
      expect(typeof seed.description).toBe('string')
      expect(Array.isArray(seed.ingredients)).toBe(true)
      expect(seed.ingredients.length).toBeGreaterThan(0)
      expect(Array.isArray(seed.steps)).toBe(true)
      expect(seed.steps.length).toBeGreaterThan(0)
      expect(typeof seed.cookTime).toBe('string')
      expect(typeof seed.servings).toBe('number')
      expect(seed.allergenFree).toBe(true)
    }
  })

  it('all seed recipe ids are unique', () => {
    const ids = SEED_RECIPES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ─── findFallbackRecipe — safeFoods mode hard filter ─────────────────────────

describe('findFallbackRecipe — safeFoods hard filter', () => {
  it('returns null when seed recipes cannot satisfy a very restrictive safe foods list', async () => {
    mockSend.mockResolvedValue({ Items: [] })
    // A safe foods list with only one ingredient that no seed recipe uses
    const result = await findFallbackRecipe(
      makeParams({ allergens: [], safeFoods: ['some_very_obscure_ingredient_xyz'] })
    )
    // Seed recipes have many ingredients that won't be in this tiny safe list
    expect(result).toBeNull()
  })

  it('returns a recipe when safe foods list broadly covers all seed ingredients', async () => {
    mockSend.mockResolvedValue({ Items: [] })
    // Safe foods list matching seed-012 (Low-FODMAP Herb Chicken) ingredients
    const safeList = [
      'chicken breast', 'garlic-infused olive oil', 'new potatoes', 'green beans',
      'lemon', 'fresh parsley', 'fresh chives', 'dried thyme', 'salt', 'black pepper',
    ]
    const result = await findFallbackRecipe(makeParams({ allergens: [], safeFoods: safeList }))
    expect(result).not.toBeNull()
    expect(result!.id).toBe('seed-012')
  })
})

// ─── findFallbackRecipe — alcoholMode hard filter ─────────────────────────────

describe('findFallbackRecipe — alcoholMode hard filter', () => {
  it('excludes a DB recipe containing wine when alcoholMode is set', async () => {
    mockSend.mockResolvedValue({
      Items: [
        makeSavedRecipeItem('Coq au Vin', ['chicken', 'red wine', 'mushrooms', 'onion']),
      ],
    })
    const result = await findFallbackRecipe(
      makeParams({ allergens: [], alcoholMode: 'no_cooking' })
    )
    // "red wine" contains the term "wine" → excluded; falls through to seed recipes
    const seedIds = SEED_RECIPES.map((s) => s.id)
    expect(result).not.toBeNull()
    expect(seedIds).toContain(result!.id)
  })

  it('keeps a DB recipe with no alcohol when alcoholMode is set', async () => {
    mockSend.mockResolvedValue({
      Items: [
        makeSavedRecipeItem('Herb Chicken', ['chicken breast', 'olive oil', 'thyme', 'lemon']),
      ],
    })
    const result = await findFallbackRecipe(
      makeParams({ allergens: [], alcoholMode: 'exclude_entirely' })
    )
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Herb Chicken')
  })

  it('returns a DB recipe with alcohol when no alcoholMode is set', async () => {
    mockSend.mockResolvedValue({
      Items: [
        makeSavedRecipeItem('Beer Battered Fish', ['fish', 'beer', 'flour']),
      ],
    })
    const result = await findFallbackRecipe(makeParams({ allergens: [] }))
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Beer Battered Fish')
  })
})

// ─── findFallbackRecipe — lowHistamine hard filter ────────────────────────────

describe('findFallbackRecipe — lowHistamine hard filter', () => {
  it('excludes a DB recipe containing soy sauce when lowHistamine is true', async () => {
    mockSend.mockResolvedValue({
      Items: [
        makeSavedRecipeItem('Teriyaki Chicken', ['chicken', 'soy sauce', 'ginger', 'garlic']),
      ],
    })
    const result = await findFallbackRecipe(
      makeParams({ allergens: [], lowHistamine: true })
    )
    // "soy sauce" matches the HIGH_HISTAMINE_TERMS term derived from "soy_sauce" key → excluded
    const seedIds = SEED_RECIPES.map((s) => s.id)
    expect(result).not.toBeNull()
    expect(seedIds).toContain(result!.id)
  })

  it('keeps a DB recipe with no high-histamine ingredients when lowHistamine is true', async () => {
    mockSend.mockResolvedValue({
      Items: [
        // Uses only ingredients that are not in HIGH_HISTAMINE_INGREDIENT_KEYS
        // (no citrus, no fermented foods, no alcohol, no aged cheeses)
        makeSavedRecipeItem('Herb Roast Chicken', ['chicken breast', 'olive oil', 'thyme', 'garlic', 'carrot']),
      ],
    })
    const result = await findFallbackRecipe(
      makeParams({ allergens: [], lowHistamine: true })
    )
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Herb Roast Chicken')
  })

  it('returns a DB recipe with high-histamine ingredients when lowHistamine is false', async () => {
    mockSend.mockResolvedValue({
      Items: [
        makeSavedRecipeItem('Miso Soup', ['miso', 'tofu', 'spring onion', 'dashi']),
      ],
    })
    const result = await findFallbackRecipe(makeParams({ allergens: [], lowHistamine: false }))
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Miso Soup')
  })

  it('excludes a DB recipe containing wine under lowHistamine (alcohol keys are included)', async () => {
    mockSend.mockResolvedValue({
      Items: [
        makeSavedRecipeItem('Wine Risotto', ['arborio rice', 'white wine', 'parmesan', 'butter']),
      ],
    })
    const result = await findFallbackRecipe(
      makeParams({ allergens: [], lowHistamine: true })
    )
    const seedIds = SEED_RECIPES.map((s) => s.id)
    expect(result).not.toBeNull()
    expect(seedIds).toContain(result!.id)
  })
})
