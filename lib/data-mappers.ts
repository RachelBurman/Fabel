import type { IngredientItem, Collection, Recipe, GeneratedRecipe } from './types'

/**
 * Convert old flat string[] profiles (or mixed arrays) to IngredientItem[].
 * Returns undefined when input is undefined so callers can detect a missing field.
 */
export function migrateIngredients(
  raw: (string | IngredientItem)[] | undefined,
): IngredientItem[] | undefined {
  if (!raw) return undefined
  return raw.map(item => {
    if (typeof item === 'string') {
      return {
        id: crypto.randomUUID(),
        name: item.trim().toLowerCase(),
        area: 'fridge' as const,
        addedAt: new Date().toISOString().split('T')[0],
      }
    }
    return item
  })
}

/** Map a DynamoDB item back to the Collection shape. */
export function itemToCollection(item: Record<string, unknown>): Collection {
  return {
    id: String(item.collectionId ?? ''),
    name: String(item.name ?? ''),
    recipeIds: Array.isArray(item.recipeIds) ? (item.recipeIds as string[]) : [],
    createdAt: String(item.createdAt ?? ''),
    updatedAt: String(item.updatedAt ?? ''),
  }
}

/** Map a DynamoDB item back to the Recipe shape. */
export function itemToRecipe(item: Record<string, unknown>): Recipe {
  return {
    id: String(item.id ?? item.recipeId ?? ''),
    title: String(item.title ?? ''),
    description: String(item.description ?? ''),
    image: String(item.image ?? ''),
    cookTime: String(item.cookTime ?? ''),
    servings: Number(item.servings ?? 1),
    matchScore: Number(item.matchScore ?? 100),
    allergens: Array.isArray(item.allergens) ? (item.allergens as string[]) : [],
    ingredients: Array.isArray(item.ingredients) ? (item.ingredients as string[]) : [],
    isSaved: true,
    fullRecipe: item.fullRecipe as GeneratedRecipe | undefined,
  }
}
