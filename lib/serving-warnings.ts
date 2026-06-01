import type { IngredientItem } from './types'

// Per-serving thresholds
// protein: 150 g or 1 piece per person
// grain:   80 g per person
// vegetable: 100 g per person

export const PROTEIN_NAMES = new Set([
  'chicken', 'beef', 'pork', 'salmon', 'tuna', 'cod', 'tofu', 'egg',
  'turkey', 'lamb', 'shrimp', 'prawn', 'duck', 'mackerel', 'haddock',
  'tilapia', 'sardine', 'anchovy', 'mince', 'bacon', 'ham', 'sausage',
  'salami', 'chorizo', 'fish', 'steak',
])

export const GRAIN_NAMES = new Set([
  'rice', 'pasta', 'oats', 'quinoa', 'noodle', 'couscous',
  'barley', 'polenta', 'bulgur', 'cornmeal',
])

export const VEGETABLE_NAMES = new Set([
  'spinach', 'broccoli', 'carrot', 'potato', 'zucchini', 'pepper',
  'cucumber', 'kale', 'tomato', 'onion', 'mushroom', 'cabbage',
  'cauliflower', 'sweet_potato', 'asparagus', 'leek', 'celery',
  'beetroot', 'parsnip', 'aubergine', 'bok_choy', 'fennel', 'pea',
  'corn', 'artichoke', 'pumpkin', 'courgette',
])

/** Convert a quantity string + unit to grams. Returns null for non-mass units. */
export function toGrams(quantity: string, unit: string): number | null {
  const qty = parseFloat(quantity)
  if (isNaN(qty)) return null
  if (unit === 'grams') return qty
  if (unit === 'kg') return qty * 1000
  return null
}

function toLabel(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Return display labels for kitchen ingredients that are likely insufficient
 * for the requested number of servings.
 *
 * Only fires when servings > 2 (the app default). Only checks ingredients
 * whose unit allows a quantity comparison (grams, kg, pieces).
 */
export function computeServingWarnings(
  ingredients: IngredientItem[],
  servings: number,
): string[] {
  if (servings <= 2) return []
  const warnings: string[] = []
  for (const ing of ingredients) {
    if (!ing.quantity) continue
    const unit = ing.unit ?? 'pieces'
    const label = ing.displayName ?? toLabel(ing.name)

    if (PROTEIN_NAMES.has(ing.name)) {
      if (unit === 'pieces') {
        const pieces = parseFloat(ing.quantity)
        if (!isNaN(pieces) && pieces < servings) warnings.push(label)
      } else {
        const grams = toGrams(ing.quantity, unit)
        if (grams !== null && grams < servings * 150) warnings.push(label)
      }
    } else if (GRAIN_NAMES.has(ing.name)) {
      const grams = toGrams(ing.quantity, unit)
      if (grams !== null && grams < servings * 80) warnings.push(label)
    } else if (VEGETABLE_NAMES.has(ing.name)) {
      const grams = toGrams(ing.quantity, unit)
      if (grams !== null && grams < servings * 100) warnings.push(label)
    }
  }
  return warnings
}
