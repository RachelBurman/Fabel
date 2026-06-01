import { migrateIngredients, itemToCollection, itemToRecipe } from '../data-mappers'

// ─── migrateIngredients ───────────────────────────────────────────────────────

describe('migrateIngredients', () => {
  it('returns undefined when input is undefined', () => {
    expect(migrateIngredients(undefined)).toBeUndefined()
  })

  it('returns an empty array for an empty input array', () => {
    expect(migrateIngredients([])).toEqual([])
  })

  it('converts a plain string to an IngredientItem', () => {
    const result = migrateIngredients(['chicken'])!
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('chicken')
    expect(result[0].area).toBe('fridge')
    expect(typeof result[0].id).toBe('string')
    expect(result[0].id.length).toBeGreaterThan(0)
    expect(result[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('trims and lowercases string items', () => {
    const result = migrateIngredients(['  GARLIC  '])!
    expect(result[0].name).toBe('garlic')
  })

  it('passes IngredientItem objects through unchanged', () => {
    const item = {
      id: 'abc',
      name: 'salmon',
      area: 'fridge' as const,
      addedAt: '2026-01-01',
      quantity: '2',
      unit: 'pieces' as const,
    }
    const result = migrateIngredients([item])!
    expect(result[0]).toBe(item)
  })

  it('handles a mixed array of strings and IngredientItems', () => {
    const existing = {
      id: 'xyz',
      name: 'garlic',
      area: 'cupboard' as const,
      addedAt: '2026-01-01',
    }
    const result = migrateIngredients(['chicken', existing])!
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('chicken')
    expect(result[1]).toBe(existing)
  })

  it('assigns each migrated string a unique id', () => {
    const result = migrateIngredients(['chicken', 'garlic'])!
    expect(result[0].id).not.toBe(result[1].id)
  })
})

// ─── itemToCollection ─────────────────────────────────────────────────────────

describe('itemToCollection', () => {
  it('maps a complete DynamoDB item to a Collection', () => {
    const item = {
      collectionId: 'col-1',
      name: 'Weeknight Dinners',
      recipeIds: ['r1', 'r2'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-05-01T00:00:00Z',
    }
    const col = itemToCollection(item)
    expect(col.id).toBe('col-1')
    expect(col.name).toBe('Weeknight Dinners')
    expect(col.recipeIds).toEqual(['r1', 'r2'])
    expect(col.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(col.updatedAt).toBe('2026-05-01T00:00:00Z')
  })

  it('defaults missing fields to empty strings / empty array', () => {
    const col = itemToCollection({})
    expect(col.id).toBe('')
    expect(col.name).toBe('')
    expect(col.recipeIds).toEqual([])
    expect(col.createdAt).toBe('')
    expect(col.updatedAt).toBe('')
  })

  it('defaults recipeIds to empty array when not an array', () => {
    const col = itemToCollection({ recipeIds: 'not-an-array' })
    expect(col.recipeIds).toEqual([])
  })

  it('casts collectionId to string', () => {
    const col = itemToCollection({ collectionId: 42 })
    expect(col.id).toBe('42')
  })
})

// ─── itemToRecipe ─────────────────────────────────────────────────────────────

describe('itemToRecipe', () => {
  it('maps a complete DynamoDB item to a Recipe', () => {
    const item = {
      id: 'rec-1',
      title: 'Lemon Chicken',
      description: 'A zesty dish.',
      image: '/img.jpg',
      cookTime: '30 min',
      servings: 4,
      matchScore: 92,
      allergens: ['gluten'],
      ingredients: ['chicken', 'lemon'],
      isSaved: true,
    }
    const recipe = itemToRecipe(item)
    expect(recipe.id).toBe('rec-1')
    expect(recipe.title).toBe('Lemon Chicken')
    expect(recipe.servings).toBe(4)
    expect(recipe.matchScore).toBe(92)
    expect(recipe.allergens).toEqual(['gluten'])
    expect(recipe.ingredients).toEqual(['chicken', 'lemon'])
    expect(recipe.isSaved).toBe(true)
  })

  it('prefers "id" over "recipeId" when both are present', () => {
    const recipe = itemToRecipe({ id: 'primary', recipeId: 'fallback' })
    expect(recipe.id).toBe('primary')
  })

  it('falls back to "recipeId" when "id" is absent', () => {
    const recipe = itemToRecipe({ recipeId: 'fallback-id' })
    expect(recipe.id).toBe('fallback-id')
  })

  it('defaults servings to 1 when missing', () => {
    const recipe = itemToRecipe({})
    expect(recipe.servings).toBe(1)
  })

  it('defaults matchScore to 100 when missing', () => {
    const recipe = itemToRecipe({})
    expect(recipe.matchScore).toBe(100)
  })

  it('defaults allergens and ingredients to empty arrays', () => {
    const recipe = itemToRecipe({})
    expect(recipe.allergens).toEqual([])
    expect(recipe.ingredients).toEqual([])
  })

  it('defaults allergens to empty array when not an array', () => {
    const recipe = itemToRecipe({ allergens: 'gluten' })
    expect(recipe.allergens).toEqual([])
  })

  it('always sets isSaved to true', () => {
    expect(itemToRecipe({}).isSaved).toBe(true)
  })

  it('includes fullRecipe when present', () => {
    const full = { title: 'Full', description: '', ingredients: [], steps: [], cookTime: '20m', servings: 2, allergenFree: true }
    const recipe = itemToRecipe({ fullRecipe: full })
    expect(recipe.fullRecipe).toBe(full)
  })

  it('leaves fullRecipe undefined when absent', () => {
    expect(itemToRecipe({}).fullRecipe).toBeUndefined()
  })
})
