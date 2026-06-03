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

export interface RecipeMacros {
  calories: number
  protein: number  // grams per serving
  carbs: number    // grams per serving
  fat: number      // grams per serving
}

export interface GeneratedRecipe {
  title: string
  description: string
  ingredients: GeneratedRecipeIngredient[]
  steps: string[]
  cookTime: string
  servings: number
  allergenFree: boolean
  macros?: RecipeMacros
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
  showMacros: boolean       // opt-in nutritional display; off by default
  activePresets: string[]   // active diet preset IDs
  lactoseIntolerant: boolean
  lactoseMode: 'include' | 'exclude' // 'include' = dairy allowed with Lactaid reminder; 'exclude' = treat dairy as allergen
  kitchenEquipment: string[] // equipment the user has available (persisted)
  darkMode: boolean           // app-level dark mode preference (persisted)
  discoverSettings: DiscoverSettings
  visibleTabs: string[]       // which nav tabs are shown; min 2
}

export interface DietPreset {
  id: string
  label: string
  emoji: string
  description: string
  ingredients: string[]     // Epicure keys to exclude
}

export const DIET_PRESETS: Record<string, DietPreset> = {
  vegan: {
    id: 'vegan',
    label: 'Vegan',
    emoji: '🌱',
    description: 'Excludes all animal products',
    ingredients: [
      'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'mince',
      'bacon', 'ham', 'sausage', 'salami', 'chorizo',
      'salmon', 'tuna', 'fish', 'cod', 'prawn', 'shrimp', 'crab',
      'lobster', 'mussel', 'oyster', 'scallop', 'anchovy', 'sardine', 'mackerel',
      'milk', 'cream', 'butter', 'cheese', 'yogurt', 'ghee',
      'egg', 'honey', 'lard', 'gelatin',
    ],
  },
  vegetarian: {
    id: 'vegetarian',
    label: 'Vegetarian',
    emoji: '🥗',
    description: 'Excludes meat and fish',
    ingredients: [
      'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'mince',
      'bacon', 'ham', 'sausage', 'salami', 'chorizo',
      'salmon', 'tuna', 'fish', 'cod', 'prawn', 'shrimp', 'crab',
      'lobster', 'mussel', 'oyster', 'scallop', 'anchovy', 'sardine', 'mackerel',
      'lard', 'gelatin',
    ],
  },
  keto: {
    id: 'keto',
    label: 'Keto',
    emoji: '🥑',
    description: 'Excludes high-carb ingredients',
    ingredients: [
      'pasta', 'rice', 'flour', 'bread', 'oats', 'quinoa', 'couscous',
      'potato', 'sweet_potato', 'corn',
      'lentil', 'chickpea', 'kidney_bean', 'black_bean', 'pea',
      'sugar', 'honey', 'maple_syrup',
      'banana', 'apple', 'grape', 'mango', 'orange',
    ],
  },
  low_fodmap: {
    id: 'low_fodmap',
    label: 'Low-FODMAP',
    emoji: '🟢',
    description: 'Excludes common FODMAP triggers',
    ingredients: [
      'garlic', 'onion', 'apple', 'pear', 'watermelon', 'cherry',
      'peach', 'mango', 'apricot',
      'honey', 'agave_nectar',
      'milk', 'cream', 'yogurt',
      'wheat', 'rye', 'barley',
      'cashew', 'pistachio',
      'lentil', 'chickpea', 'kidney_bean', 'black_bean',
    ],
  },
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

export interface DiscoverSettings {
  showDiscover: boolean
  showTrendingForYou: boolean
  showTrendingGlobally: boolean
  showMostLoved: boolean
  showTrendingPairings: boolean
}

export const DEFAULT_DISCOVER_SETTINGS: DiscoverSettings = {
  showDiscover: true,
  showTrendingForYou: true,
  showTrendingGlobally: true,
  showMostLoved: true,
  showTrendingPairings: true,
}

export const ALL_TABS = ['kitchen', 'recipe', 'discover', 'substitutes', 'history', 'saved'] as const
export type TabId = typeof ALL_TABS[number]

export interface RecipeSuggestion {
  direction: string
  reasoning: string
  noveltyNote: string
}

export interface StoredTasteProfile {
  preferred: string[]
  avoided: string[]
  emerging: string[]
  fading: string[]
  formatSignals: string[]
  strength: 'soft' | 'full'
  signalCount: number
  recipeSuggestions: RecipeSuggestion[]
  lastComputedAt: string
}

export interface RecipeBrief {
  direction: string | null
  reasoning: string | null
  keyIngredients: string[]
  noveltyNote: string | null
  loadingHints: string[]
}

export interface InsightIngredient {
  key: string
  likeCount: number
  score: number
}

export interface InsightPairing {
  beverage: string
  recipeType: string
  score: number
}

export interface InsightRecipeType {
  cuisine: string
  occasion: string
  score: number
}

export interface IngredientInsightsRecord {
  allergenProfile: string
  timeWindow: string
  trendingIngredients: InsightIngredient[]
  trendingPairings: InsightPairing[]
  trendingRecipeTypes: InsightRecipeType[]
  lastUpdated: string
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
