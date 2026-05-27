import { type Recipe } from '@/lib/types'

// Placeholder API functions - to be wired up with real logic later

/**
 * Fetches recipe suggestions based on user's allergens and available ingredients
 * @param allergens - Array of allergen IDs to avoid
 * @param ingredients - Array of available ingredient names
 * @returns Promise resolving to array of safe, flavour-matched recipes
 */
export async function fetchRecipeSuggestions(
  allergens: string[],
  ingredients: string[]
): Promise<Recipe[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1200))

  // Placeholder recipes - will be replaced with actual API call
  const mockRecipes: Recipe[] = [
    {
      id: '1',
      title: 'Mediterranean Quinoa Bowl',
      description: 'A vibrant bowl packed with roasted vegetables, fresh herbs, and a tangy lemon dressing.',
      image: '/placeholder-recipe-1.jpg',
      cookTime: '35 min',
      servings: 4,
      matchScore: 95,
      allergens: ['gluten', 'dairy', 'eggs', 'nuts'],
      ingredients: ['quinoa', 'cucumber', 'tomatoes', 'olives', 'lemon'],
    },
    {
      id: '2',
      title: 'Thai Coconut Curry',
      description: 'Creamy coconut curry with tender vegetables and aromatic spices.',
      image: '/placeholder-recipe-2.jpg',
      cookTime: '40 min',
      servings: 4,
      matchScore: 88,
      allergens: ['gluten', 'dairy', 'eggs', 'shellfish'],
      ingredients: ['coconut milk', 'vegetables', 'curry paste', 'rice'],
    },
    {
      id: '3',
      title: 'Herb-Crusted Salmon',
      description: 'Perfectly seared salmon with a fragrant herb crust and roasted asparagus.',
      image: '/placeholder-recipe-3.jpg',
      cookTime: '25 min',
      servings: 2,
      matchScore: 82,
      allergens: ['gluten', 'dairy', 'eggs', 'shellfish'],
      ingredients: ['salmon', 'herbs', 'asparagus', 'olive oil'],
    },
    {
      id: '4',
      title: 'Stuffed Bell Peppers',
      description: 'Colorful bell peppers filled with seasoned rice, beans, and fresh vegetables.',
      image: '/placeholder-recipe-4.jpg',
      cookTime: '45 min',
      servings: 4,
      matchScore: 78,
      allergens: ['gluten', 'dairy', 'eggs', 'nuts', 'soy'],
      ingredients: ['bell peppers', 'rice', 'black beans', 'corn'],
    },
    {
      id: '5',
      title: 'Lemon Garlic Chicken',
      description: 'Tender chicken thighs roasted with bright lemon and aromatic garlic.',
      image: '/placeholder-recipe-5.jpg',
      cookTime: '50 min',
      servings: 4,
      matchScore: 75,
      allergens: ['gluten', 'dairy', 'eggs', 'nuts', 'soy', 'fish'],
      ingredients: ['chicken', 'lemon', 'garlic', 'herbs'],
    },
    {
      id: '6',
      title: 'Vegetable Stir Fry',
      description: 'Crispy vegetables in a savory sauce, served over steamed jasmine rice.',
      image: '/placeholder-recipe-6.jpg',
      cookTime: '20 min',
      servings: 2,
      matchScore: 70,
      allergens: ['gluten', 'dairy', 'eggs', 'nuts'],
      ingredients: ['mixed vegetables', 'tamari', 'rice', 'sesame oil'],
    },
  ]

  // Filter recipes based on allergens (placeholder logic)
  const filteredRecipes = mockRecipes.filter(recipe => {
    // Check if recipe is safe for all user allergens
    return allergens.every(allergen => recipe.allergens.includes(allergen))
  })

  return filteredRecipes.length > 0 ? filteredRecipes : mockRecipes
}

/**
 * Saves a recipe to the user's collection
 * @param recipeId - ID of the recipe to save
 */
export async function saveRecipeToCollection(recipeId: string): Promise<void> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // Placeholder - will be replaced with actual API call
  console.log(`Recipe ${recipeId} saved to collection`)
}

/**
 * Removes a recipe from the user's collection
 * @param recipeId - ID of the recipe to remove
 */
export async function removeRecipeFromCollection(recipeId: string): Promise<void> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // Placeholder - will be replaced with actual API call
  console.log(`Recipe ${recipeId} removed from collection`)
}

/**
 * Fetches the user's saved recipes
 * @returns Promise resolving to array of saved recipes
 */
export async function fetchSavedRecipes(): Promise<Recipe[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800))
  
  // Placeholder - will be replaced with actual API call
  return []
}

/**
 * Searches for ingredients based on user input
 * @param query - Search query string
 * @returns Promise resolving to array of matching ingredient names
 */
export async function searchIngredients(query: string): Promise<string[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200))
  
  // Placeholder ingredient suggestions
  const allIngredients = [
    'chicken', 'beef', 'salmon', 'tofu', 'eggs',
    'rice', 'pasta', 'quinoa', 'bread', 'potatoes',
    'tomatoes', 'onions', 'garlic', 'peppers', 'carrots',
    'broccoli', 'spinach', 'mushrooms', 'zucchini', 'corn',
    'olive oil', 'butter', 'coconut milk', 'vegetable broth',
    'lemon', 'lime', 'herbs', 'spices', 'cheese', 'yogurt',
  ]
  
  const normalizedQuery = query.toLowerCase().trim()
  return allIngredients.filter(ing => 
    ing.toLowerCase().includes(normalizedQuery)
  )
}
