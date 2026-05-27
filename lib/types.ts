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
}

export interface UserPreferences {
  allergens: string[]
  ingredients: string[]
  savedRecipes: string[]
}

// List of all allergens
export const ALLERGENS: Allergen[] = [
  { id: 'gluten', name: 'Gluten', icon: '🌾' },
  { id: 'dairy', name: 'Dairy', icon: '🥛' },
  { id: 'eggs', name: 'Eggs', icon: '🥚' },
  { id: 'peanuts', name: 'Peanuts', icon: '🥜' },
  { id: 'tree-nuts', name: 'Tree Nuts', icon: '🌰' },
  { id: 'shellfish', name: 'Shellfish', icon: '🦐' },
  { id: 'fish', name: 'Fish', icon: '🐟' },
  { id: 'soy', name: 'Soy', icon: '🫘' },
  { id: 'sesame', name: 'Sesame', icon: '🌱' },
  { id: 'mustard', name: 'Mustard', icon: '🟡' },
  { id: 'celery', name: 'Celery', icon: '🥬' },
  { id: 'sulphites', name: 'Sulphites', icon: '🍷' },
  { id: 'lupin', name: 'Lupin', icon: '🌸' },
  { id: 'molluscs', name: 'Molluscs', icon: '🦪' },
]
