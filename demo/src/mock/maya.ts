// Maya — demo account: gluten-free + dairy-free, 23 feedback signals.
// Data shapes mirror the exact types in lib/types.ts and /api/insights responses.

export const MAYA = {
  name: 'Maya',
  allergens: ['gluten', 'milk'],
  profileKey: 'gluten-milk',
}

// Matches InsightsData returned by /api/insights
export const MAYA_INSIGHTS = {
  profileKey: 'gluten-milk',
  weekStr: '2026-W25',
  allergens: ['gluten', 'milk'],
  customAllergens: [],

  tasteProfile: {
    preferred: ['Garlic', 'Lemon', 'Thyme'],
    avoided: ['Cilantro'],
    flavourTerritory: ['Mediterranean', 'Light & Fresh'],
    formatSignals: ['Quick to make', 'Great cuisine choice'],
    signalCount: 23,
    recipeSuggestions: [
      {
        direction: 'Herb-crusted salmon with roasted Mediterranean vegetables',
        reasoning:
          'Builds on your love of garlic and fresh herbs with a quick, light preparation style.',
        noveltyNote:
          'A step up from your usual weeknight salads — same lightness, more substance.',
      },
      {
        direction: 'Thai-inspired glass noodle salad with lime & coriander-free dressing',
        reasoning:
          'Your pattern of liking citrus, light textures, and quick meals points strongly here.',
      },
    ],
  },

  trendingForYou: [
    { cuisine: 'Mediterranean', occasion: 'weeknight-dinner', seedIngredients: ['garlic', 'lemon'] },
    { cuisine: 'Japanese',      occasion: 'light-lunch',      seedIngredients: ['sesame', 'rice'] },
    { cuisine: 'Middle Eastern',occasion: 'weekend-dinner',   seedIngredients: ['garlic', 'thyme'] },
  ],

  // Matches IngredientInsightsRecord shape from lib/types.ts
  profileWeek: {
    allergenProfile: 'gluten-milk',
    timeWindow: '2026-W25',
    trendingIngredients: [
      { key: 'garlic',         likeCount: 8,  score: 0.95 },
      { key: 'lemon',          likeCount: 7,  score: 0.88 },
      { key: 'thyme',          likeCount: 5,  score: 0.80 },
    ],
    trendingPairings: [
      { beverage: 'Sparkling water', recipeType: 'Mediterranean' },
      { beverage: 'Herbal tea',      recipeType: 'light salads'  },
      { beverage: 'Dry white wine',  recipeType: 'seafood'       },
    ],
    trendingRecipeTypes: [
      { cuisine: 'Mediterranean', occasion: 'weeknight-dinner' },
    ],
    lastUpdated: '2026-06-15T10:00:00Z',
  },

  profileAllTime: {
    allergenProfile: 'gluten-milk',
    timeWindow: 'all-time',
    trendingIngredients: [
      { key: 'garlic',         likeCount: 14, score: 0.95 },
      { key: 'lemon',          likeCount: 11, score: 0.88 },
      { key: 'thyme',          likeCount: 9,  score: 0.80 },
      { key: 'chicken breast', likeCount: 8,  score: 0.75 },
      { key: 'spinach',        likeCount: 6,  score: 0.68 },
      { key: 'olive oil',      likeCount: 5,  score: 0.62 },
    ],
    trendingPairings: [],
    trendingRecipeTypes: [],
    lastUpdated: '2026-06-15T10:00:00Z',
  },

  globalWeek: {
    allergenProfile: 'global',
    timeWindow: '2026-W25',
    trendingIngredients: [
      { key: 'garlic',  likeCount: 124, score: 0.95 },
      { key: 'lemon',   likeCount: 98,  score: 0.88 },
      { key: 'chicken', likeCount: 89,  score: 0.84 },
      { key: 'tomato',  likeCount: 76,  score: 0.78 },
      { key: 'spinach', likeCount: 61,  score: 0.70 },
    ],
    trendingPairings: [],
    trendingRecipeTypes: [],
    lastUpdated: '2026-06-15T10:00:00Z',
  },
}
