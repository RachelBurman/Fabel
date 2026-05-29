import { getAllergensForIngredient } from '../epicure'

describe('getAllergensForIngredient', () => {
  it('oat_milk has no dairy (milk) allergen', () => {
    expect(getAllergensForIngredient('oat_milk')).not.toContain('milk')
  })

  it('almond_milk has tree_nuts allergen', () => {
    expect(getAllergensForIngredient('almond_milk')).toContain('tree_nuts')
  })

  it('milk has milk allergen', () => {
    expect(getAllergensForIngredient('milk')).toContain('milk')
  })

  it('king_oyster_mushroom has no molluscs allergen', () => {
    // Mushrooms are fungi, not molluscs. Verifies no false positive for
    // ingredients with "oyster" in the name.
    expect(getAllergensForIngredient('king_oyster_mushroom')).not.toContain('molluscs')
  })

  it('chicken has no allergens', () => {
    expect(getAllergensForIngredient('chicken')).toHaveLength(0)
  })

  it('wheat has gluten allergen', () => {
    expect(getAllergensForIngredient('wheat')).toContain('gluten')
  })

  it('returns empty array for unknown ingredients', () => {
    expect(getAllergensForIngredient('zzz_not_a_real_ingredient')).toEqual([])
  })
})
