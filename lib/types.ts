// Types for the Fable app

export interface Allergen {
  id: string
  name: string
  icon: string
}

export interface Ingredient {
  id: string
  name: string
}

export interface Recipe {
  id: string
  title: string
  description: string
  image: string
  cookTime: string
  servings: number
  matchScore: number
  allergens: string[] // allergens NOT present (safe)
  ingredients: string[]
  isSaved?: boolean
  fullRecipe?: GeneratedRecipe // full AI-generated recipe data when saved from generation
}

export interface GeneratedRecipeIngredient {
  name: string
  amount: number | string
  unit: string
}

export interface GeneratedRecipe {
  title: string
  description: string
  ingredients: GeneratedRecipeIngredient[]
  steps: string[]
  cookTime: string
  servings: number
  allergenFree: boolean
}

export type IngredientArea = 'fridge' | 'freezer' | 'cupboard' | 'pantry'
export type IngredientDateType = 'use-by' | 'bought'

export const INGREDIENT_UNITS = ['pieces', 'grams', 'kg', 'ml', 'litres', 'tbsp', 'tsp', 'cups'] as const
export type IngredientUnit = typeof INGREDIENT_UNITS[number]

export interface IngredientItem {
  id: string
  name: string           // Epicure key (e.g. "chicken")
  displayName?: string   // User-visible label (e.g. "Chicken Breast")
  subtype?: string       // Specific cut/variety (e.g. "breast", "ribeye", "baby")
  quantity?: string      // e.g. "2"
  unit?: IngredientUnit  // e.g. "pieces"
  area: IngredientArea
  dateType?: IngredientDateType
  useByDate?: string     // YYYY-MM-DD, set when dateType='use-by'
  boughtDate?: string    // YYYY-MM-DD, set when dateType='bought'
  addedAt: string        // YYYY-MM-DD
}

export interface UserPreferences {
  allergens: string[]
  customAllergens: string[] // specific Epicure ingredients to avoid
  ingredients: IngredientItem[]
  savedRecipes: string[]
  safeIngredients: string[] // ingredients the user can definitely eat (Safe Foods Mode)
  safeFoodsMode: boolean    // restrict generation to safeIngredients only
}

export interface PairingSuggestion {
  ingredient: string
  score: number
  allergens: string[]
}

export interface HistoryEntry {
  id: string
  recipe: GeneratedRecipe
  timestamp: number
}

export interface Collection {
  id: string        // collectionId
  name: string
  recipeIds: string[]
  createdAt: string
  updatedAt: string
}

// List of all allergens
export const ALLERGENS: Allergen[] = [
  { id: 'gluten', name: 'Gluten', icon: '🌾' },
  { id: 'milk', name: 'Dairy', icon: '🥛' },
  { id: 'eggs', name: 'Eggs', icon: '🥚' },
  { id: 'peanuts', name: 'Peanuts', icon: '🥜' },
  { id: 'tree_nuts', name: 'Tree Nuts', icon: '🌰' },
  { id: 'crustaceans', name: 'Shellfish', icon: '🦐' },
  { id: 'fish', name: 'Fish', icon: '🐟' },
  { id: 'soy', name: 'Soy', icon: '🫘' },
  { id: 'sesame', name: 'Sesame', icon: '🌱' },
  { id: 'mustard', name: 'Mustard', icon: '🟡' },
  { id: 'celery', name: 'Celery', icon: '🥬' },
  { id: 'sulphites', name: 'Sulphites', icon: '🍷' },
  { id: 'lupin', name: 'Lupin', icon: '🌸' },
  { id: 'molluscs', name: 'Molluscs', icon: '🦪' },
]
