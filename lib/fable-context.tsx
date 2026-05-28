'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { type UserPreferences, type Recipe, type GeneratedRecipe, type HistoryEntry } from '@/lib/types'

interface FableContextType {
  preferences: UserPreferences
  setAllergens: (allergens: string[]) => void
  toggleAllergen: (allergenId: string) => void
  toggleCustomAllergen: (ingredient: string) => void
  setIngredients: (ingredients: string[]) => void
  addIngredient: (ingredient: string) => void
  removeIngredient: (ingredient: string) => void
  savedRecipes: Recipe[]
  saveRecipe: (recipe: Recipe) => void
  unsaveRecipe: (recipeId: string) => void
  isRecipeSaved: (recipeId: string) => boolean
  recipeHistory: HistoryEntry[]
  addToHistory: (entry: HistoryEntry) => void
  hasCompletedOnboarding: boolean
  completeOnboarding: () => void
}

const FableContext = createContext<FableContextType | undefined>(undefined)

export function FableProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    allergens: [],
    customAllergens: [],
    ingredients: [],
    savedRecipes: [],
  })
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([])
  const [recipeHistory, setRecipeHistory] = useState<HistoryEntry[]>([])
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)

  const setAllergens = useCallback((allergens: string[]) => {
    setPreferences(prev => ({ ...prev, allergens }))
  }, [])

  const toggleAllergen = useCallback((allergenId: string) => {
    setPreferences(prev => ({
      ...prev,
      allergens: prev.allergens.includes(allergenId)
        ? prev.allergens.filter(a => a !== allergenId)
        : [...prev.allergens, allergenId],
    }))
  }, [])

  const toggleCustomAllergen = useCallback((ingredient: string) => {
    setPreferences(prev => ({
      ...prev,
      customAllergens: prev.customAllergens.includes(ingredient)
        ? prev.customAllergens.filter(a => a !== ingredient)
        : [...prev.customAllergens, ingredient],
    }))
  }, [])

  const setIngredients = useCallback((ingredients: string[]) => {
    setPreferences(prev => ({ ...prev, ingredients }))
  }, [])

  const addIngredient = useCallback((ingredient: string) => {
    const normalized = ingredient.trim().toLowerCase()
    if (!normalized) return
    setPreferences(prev => ({
      ...prev,
      ingredients: prev.ingredients.includes(normalized)
        ? prev.ingredients
        : [...prev.ingredients, normalized],
    }))
  }, [])

  const removeIngredient = useCallback((ingredient: string) => {
    setPreferences(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter(i => i !== ingredient),
    }))
  }, [])

  const saveRecipe = useCallback((recipe: Recipe) => {
    setSavedRecipes(prev => {
      if (prev.some(r => r.id === recipe.id)) return prev
      return [...prev, { ...recipe, isSaved: true }]
    })
    setPreferences(prev => ({
      ...prev,
      savedRecipes: prev.savedRecipes.includes(recipe.id)
        ? prev.savedRecipes
        : [...prev.savedRecipes, recipe.id],
    }))
  }, [])

  const unsaveRecipe = useCallback((recipeId: string) => {
    setSavedRecipes(prev => prev.filter(r => r.id !== recipeId))
    setPreferences(prev => ({
      ...prev,
      savedRecipes: prev.savedRecipes.filter(id => id !== recipeId),
    }))
  }, [])

  const isRecipeSaved = useCallback((recipeId: string) => {
    return savedRecipes.some(r => r.id === recipeId)
  }, [savedRecipes])

  const addToHistory = useCallback((entry: HistoryEntry) => {
    setRecipeHistory(prev => [entry, ...prev])
  }, [])

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true)
  }, [])

  return (
    <FableContext.Provider
      value={{
        preferences,
        setAllergens,
        toggleAllergen,
        toggleCustomAllergen,
        setIngredients,
        addIngredient,
        removeIngredient,
        savedRecipes,
        saveRecipe,
        unsaveRecipe,
        isRecipeSaved,
        recipeHistory,
        addToHistory,
        hasCompletedOnboarding,
        completeOnboarding,
      }}
    >
      {children}
    </FableContext.Provider>
  )
}

export function useFable() {
  const context = useContext(FableContext)
  if (!context) {
    throw new Error('useFable must be used within a FableProvider')
  }
  return context
}
