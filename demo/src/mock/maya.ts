// Maya — demo account: gluten-free + dairy-free, active taste history
// Mirrors the shape returned by /api/insights for a personalised user

export const MAYA = {
  name: 'Maya',
  email: 'maya@demo.fable.app',
  allergens: ['gluten', 'milk'],
  profileKey: 'gluten-milk',
}

export const MAYA_TASTE_PROFILE = {
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
      noveltyNote: 'A step up from your usual weeknight salads — same lightness, more substance.',
    },
    {
      direction: 'Thai-inspired glass noodle salad with lime & coriander-free dressing',
      reasoning:
        'Your pattern of liking citrus, light textures, and quick meals points strongly here.',
    },
  ],
}

export const MAYA_TRENDING_FOR_YOU = [
  { cuisine: 'Mediterranean', occasion: 'weeknight-dinner', seedIngredients: ['garlic', 'lemon'] },
  { cuisine: 'Japanese', occasion: 'light-lunch', seedIngredients: ['sesame', 'rice'] },
  { cuisine: 'Middle Eastern', occasion: 'weekend-dinner', seedIngredients: ['garlic', 'thyme'] },
]

export const MAYA_MOST_LOVED = [
  { key: 'garlic',         score: 0.95, likeCount: 14 },
  { key: 'lemon',          score: 0.88, likeCount: 11 },
  { key: 'thyme',          score: 0.80, likeCount: 9  },
  { key: 'chicken breast', score: 0.75, likeCount: 8  },
  { key: 'spinach',        score: 0.68, likeCount: 6  },
  { key: 'olive oil',      score: 0.62, likeCount: 5  },
]

export const GLOBAL_TRENDING = [
  { key: 'garlic',        likeCount: 124, score: 0.95 },
  { key: 'lemon',         likeCount: 98,  score: 0.88 },
  { key: 'chicken',       likeCount: 89,  score: 0.84 },
  { key: 'tomato',        likeCount: 76,  score: 0.78 },
  { key: 'spinach',       likeCount: 61,  score: 0.70 },
]

export const TRENDING_PAIRINGS = [
  { beverage: 'Sparkling water', recipeType: 'Mediterranean' },
  { beverage: 'Herbal tea',      recipeType: 'light salads'  },
  { beverage: 'Dry white wine',  recipeType: 'seafood'       },
]
