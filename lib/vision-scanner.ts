import type { IngredientItem, IngredientArea } from '@/lib/types'

export interface VisionIngredient {
  displayName: string
  epicureKey: string
  confident: boolean
}

export interface VisionResult {
  inferredArea: IngredientArea | 'unknown'
  areaConfident: boolean
  ingredients: VisionIngredient[]
}

export interface ReviewIngredient extends VisionIngredient {
  checked: boolean
  alreadyInKitchen: boolean
}

/**
 * Match a Claude-returned ingredient name against a list of Epicure keys.
 * Returns null if no adequate match is found (< 0.4 token overlap).
 *
 * Strategy:
 *  1. Exact key match → confident unless Claude flagged uncertain
 *  2. Longest prefix-token match → confident only if full match ratio ≥ 0.8
 *  3. Best token-overlap match → confident only if score ≥ 0.8
 */
export function matchToEpicureKey(
  name: string,
  uncertain: boolean,
  allKeys: string[]
): { epicureKey: string; confident: boolean } | null {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const asKey = normalized.replace(/\s+/g, '_')

  if (allKeys.includes(asKey)) {
    return { epicureKey: asKey, confident: !uncertain }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean)

  // Longest prefix match
  for (let len = tokens.length; len >= 1; len--) {
    const candidate = tokens.slice(0, len).join('_')
    if (allKeys.includes(candidate)) {
      const matchRatio = len / tokens.length
      return { epicureKey: candidate, confident: !uncertain && matchRatio >= 0.8 }
    }
  }

  // Token overlap scoring
  let bestKey: string | null = null
  let bestScore = 0

  for (const key of allKeys) {
    const keyTokens = new Set(key.split('_'))
    const overlap = tokens.filter(t => keyTokens.has(t)).length
    const score = overlap / Math.max(tokens.length, keyTokens.size)
    if (score > bestScore) {
      bestScore = score
      bestKey = key
    }
  }

  if (bestKey && bestScore >= 0.4) {
    return { epicureKey: bestKey, confident: !uncertain && bestScore >= 0.8 }
  }

  return null
}

/**
 * Build the review ingredient list from a Lambda response.
 * Ingredients already in the kitchen are pre-deselected to prevent duplicates.
 */
export function buildReviewIngredients(
  visionIngredients: VisionIngredient[],
  existingKitchenKeys: string[]
): ReviewIngredient[] {
  const existingSet = new Set(existingKitchenKeys.map(k => k.toLowerCase()))
  return visionIngredients.map(ing => ({
    ...ing,
    alreadyInKitchen: existingSet.has(ing.epicureKey.toLowerCase()),
    checked: !existingSet.has(ing.epicureKey.toLowerCase()),
  }))
}

/**
 * Convert checked review ingredients into IngredientItem objects ready for the kitchen.
 * now should be a ISO date string (YYYY-MM-DD).
 */
export function buildKitchenIngredients(
  reviewIngredients: ReviewIngredient[],
  area: IngredientArea,
  now: string
): IngredientItem[] {
  return reviewIngredients
    .filter(ing => ing.checked)
    .map((ing, i) => ({
      id: `vision-${now}-${i}`,
      name: ing.epicureKey,
      displayName: ing.displayName.charAt(0).toUpperCase() + ing.displayName.slice(1),
      area,
      addedAt: now,
    }))
}
