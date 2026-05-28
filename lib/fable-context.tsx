'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { type UserPreferences, type Recipe, type GeneratedRecipe, type HistoryEntry, type IngredientItem, type IngredientArea } from '@/lib/types'

interface FableContextType {
  preferences: UserPreferences
  setAllergens: (allergens: string[]) => void
  toggleAllergen: (allergenId: string) => void
  toggleCustomAllergen: (ingredient: string) => void
  setIngredients: (ingredients: IngredientItem[]) => void
  addIngredient: (name: string, options?: { area?: IngredientArea; useByDate?: string }) => void
  removeIngredient: (name: string) => void
  addSafeIngredient: (ingredient: string) => void
  removeSafeIngredient: (ingredient: string) => void
  setSafeFoodsMode: (active: boolean) => void
  savedRecipes: Recipe[]
  saveRecipe: (recipe: Recipe) => void
  unsaveRecipe: (recipeId: string) => void
  isRecipeSaved: (recipeId: string) => boolean
  recipeHistory: HistoryEntry[]
  addToHistory: (entry: HistoryEntry) => void
  hasCompletedOnboarding: boolean
  completeOnboarding: () => void
  isLoadingProfile: boolean
}

const FableContext = createContext<FableContextType | undefined>(undefined)

// Convert old flat string[] format (or mixed) to IngredientItem[]
function migrateIngredients(raw: (string | IngredientItem)[] | undefined): IngredientItem[] | undefined {
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

// Map a DynamoDB item back to the Recipe shape
function itemToRecipe(item: Record<string, unknown>): Recipe {
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

export function FableProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    allergens: [],
    customAllergens: [],
    ingredients: [] as IngredientItem[],
    savedRecipes: [],
    safeIngredients: [],
    safeFoodsMode: false,
  })
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([])
  const [recipeHistory, setRecipeHistory] = useState<HistoryEntry[]>([])
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  const userIdRef = useRef<string>('')

  // ── Initialise: load userId + fetch profile + saved recipes ─────────────────
  useEffect(() => {
    const init = async () => {
      let uid = localStorage.getItem('fable_user_id')
      if (!uid) {
        uid = crypto.randomUUID()
        localStorage.setItem('fable_user_id', uid)
        // New user — no profile to fetch
        userIdRef.current = uid
        setIsLoadingProfile(false)
        return
      }

      userIdRef.current = uid

      try {
        const [profileRes, savedRes] = await Promise.all([
          fetch(`/api/user/profile?userId=${uid}`),
          fetch(`/api/user/saved-recipes?userId=${uid}`),
        ])

        if (profileRes.ok) {
          const profile: {
            allergens?: string[]
            customAllergens?: string[]
            ingredients?: (string | IngredientItem)[]
            safeIngredients?: string[]
            safeFoodsMode?: boolean
          } = await profileRes.json()
          // Only restore state if the profile has actual data
          if (profile.allergens !== undefined || profile.ingredients !== undefined) {
            setPreferences(prev => ({
              ...prev,
              allergens: profile.allergens ?? prev.allergens,
              customAllergens: profile.customAllergens ?? prev.customAllergens,
              ingredients: migrateIngredients(profile.ingredients) ?? prev.ingredients,
              safeIngredients: profile.safeIngredients ?? prev.safeIngredients,
              safeFoodsMode: profile.safeFoodsMode ?? prev.safeFoodsMode,
            }))
            setHasCompletedOnboarding(true)
          }
        }

        if (savedRes.ok) {
          const data: { recipes: Record<string, unknown>[] } = await savedRes.json()
          if (data.recipes?.length) {
            const recipes = data.recipes.map(itemToRecipe)
            setSavedRecipes(recipes)
            setPreferences(prev => ({
              ...prev,
              savedRecipes: recipes.map(r => r.id),
            }))
          }
        }
      } catch (err) {
        console.error('Failed to load profile from DynamoDB:', err)
        // Fail silently — the app works offline with local defaults
      } finally {
        setIsLoadingProfile(false)
      }
    }

    init()
  }, [])

  // ── Debounced auto-save: persist the full profile whenever it changes ────────
  const syncingRef = useRef(false)
  useEffect(() => {
    if (isLoadingProfile || !userIdRef.current) return
    const id = setTimeout(async () => {
      if (syncingRef.current) return
      syncingRef.current = true
      try {
        await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userIdRef.current,
            allergens: preferences.allergens,
            customAllergens: preferences.customAllergens,
            ingredients: preferences.ingredients,
            safeIngredients: preferences.safeIngredients,
            safeFoodsMode: preferences.safeFoodsMode,
          }),
        })
      } catch (err) {
        console.error('Failed to sync profile:', err)
      } finally {
        syncingRef.current = false
      }
    }, 1500)
    return () => clearTimeout(id)
  }, [isLoadingProfile, preferences.allergens, preferences.customAllergens, preferences.ingredients, preferences.safeIngredients, preferences.safeFoodsMode])

  // ── Preference mutators ──────────────────────────────────────────────────────

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

  const setIngredients = useCallback((ingredients: IngredientItem[]) => {
    setPreferences(prev => ({ ...prev, ingredients }))
  }, [])

  const addIngredient = useCallback((name: string, options?: { area?: IngredientArea; useByDate?: string }) => {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return
    setPreferences(prev => {
      if (prev.ingredients.some(i => i.name === normalized)) return prev
      const item: IngredientItem = {
        id: crypto.randomUUID(),
        name: normalized,
        area: options?.area ?? 'fridge',
        addedAt: new Date().toISOString().split('T')[0],
        ...(options?.useByDate ? { useByDate: options.useByDate } : {}),
      }
      return { ...prev, ingredients: [...prev.ingredients, item] }
    })
  }, [])

  const removeIngredient = useCallback((name: string) => {
    setPreferences(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter(i => i.name !== name),
    }))
  }, [])

  const addSafeIngredient = useCallback((ingredient: string) => {
    const normalized = ingredient.trim().toLowerCase()
    if (!normalized) return
    setPreferences(prev => ({
      ...prev,
      safeIngredients: prev.safeIngredients.includes(normalized)
        ? prev.safeIngredients
        : [...prev.safeIngredients, normalized],
    }))
  }, [])

  const removeSafeIngredient = useCallback((ingredient: string) => {
    setPreferences(prev => ({
      ...prev,
      safeIngredients: prev.safeIngredients.filter(i => i !== ingredient),
    }))
  }, [])

  const setSafeFoodsMode = useCallback((active: boolean) => {
    setPreferences(prev => ({ ...prev, safeFoodsMode: active }))
  }, [])

  // ── Saved recipes — local state + DynamoDB ───────────────────────────────────

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
    // Persist to DynamoDB (fire and forget)
    if (userIdRef.current) {
      fetch('/api/user/saved-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdRef.current, recipe }),
      }).catch(err => console.error('Failed to persist saved recipe:', err))
    }
  }, [])

  const unsaveRecipe = useCallback((recipeId: string) => {
    setSavedRecipes(prev => prev.filter(r => r.id !== recipeId))
    setPreferences(prev => ({
      ...prev,
      savedRecipes: prev.savedRecipes.filter(id => id !== recipeId),
    }))
    // Delete from DynamoDB (fire and forget)
    if (userIdRef.current) {
      fetch(
        `/api/user/saved-recipes/${encodeURIComponent(recipeId)}?userId=${userIdRef.current}`,
        { method: 'DELETE' }
      ).catch(err => console.error('Failed to delete saved recipe:', err))
    }
  }, [])

  const isRecipeSaved = useCallback((recipeId: string) => {
    return savedRecipes.some(r => r.id === recipeId)
  }, [savedRecipes])

  // ── History (session-only) ───────────────────────────────────────────────────

  const addToHistory = useCallback((entry: HistoryEntry) => {
    setRecipeHistory(prev => [entry, ...prev])
  }, [])

  // ── Onboarding ───────────────────────────────────────────────────────────────

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
        addSafeIngredient,
        removeSafeIngredient,
        setSafeFoodsMode,
        savedRecipes,
        saveRecipe,
        unsaveRecipe,
        isRecipeSaved,
        recipeHistory,
        addToHistory,
        hasCompletedOnboarding,
        completeOnboarding,
        isLoadingProfile,
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
