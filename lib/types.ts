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

export interface UserPreferences {
  allergens: string[]
  customAllergens: string[] // specific Epicure ingredients to avoid
  ingredients: string[]
  savedRecipes: string[]
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
