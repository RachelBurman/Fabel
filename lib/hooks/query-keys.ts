export const queryKeys = {
  profile: (userId: string, isSignedIn: boolean) =>
    ['profile', userId, isSignedIn] as const,

  savedRecipes: (userId: string, isSignedIn: boolean) =>
    ['savedRecipes', userId, isSignedIn] as const,

  collections: (userId: string, isSignedIn: boolean) =>
    ['collections', userId, isSignedIn] as const,

  insights: (userId: string, isSignedIn: boolean) =>
    ['insights', userId, isSignedIn] as const,

  history: (userId: string, isSignedIn: boolean) =>
    ['history', userId, isSignedIn] as const,

  dislikedPatterns: (userId: string) =>
    ['dislikedPatterns', userId] as const,

  ingredientSearch: (query: string) =>
    ['ingredientSearch', query] as const,
} as const
