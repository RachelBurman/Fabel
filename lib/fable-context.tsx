'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useSession } from '@/lib/auth-client'
import { type UserPreferences, type Recipe, type GeneratedRecipe, type HistoryEntry, type IngredientItem, type IngredientArea, type IngredientDateType, type IngredientUnit, type Collection, type DiscoverSettings, DIET_PRESETS, DEFAULT_DISCOVER_SETTINGS, ALL_TABS } from '@/lib/types'
import { migrateIngredients, itemToCollection, itemToRecipe } from '@/lib/data-mappers'

interface FableContextType {
  preferences: UserPreferences
  setAllergens: (allergens: string[]) => void
  toggleAllergen: (allergenId: string) => void
  toggleCustomAllergen: (ingredient: string) => void
  setIngredients: (ingredients: IngredientItem[]) => void
  addIngredient: (name: string, options?: {
    area?: IngredientArea
    displayName?: string
    subtype?: string
    quantity?: string
    unit?: IngredientUnit
    dateType?: IngredientDateType
    useByDate?: string
    boughtDate?: string
  }) => void
  removeIngredient: (name: string) => void
  addSafeIngredient: (ingredient: string) => void
  removeSafeIngredient: (ingredient: string) => void
  setSafeFoodsMode: (active: boolean) => void
  setShowMacros: (active: boolean) => void
  togglePreset: (presetId: string) => void
  setLactoseIntolerant: (active: boolean) => void
  setLactoseMode: (mode: 'include' | 'exclude') => void
  setKitchenEquipment: (equipment: string[]) => void
  toggleKitchenEquipment: (item: string) => void
  setDarkMode: (dark: boolean) => void
  setDiscoverSettings: (settings: DiscoverSettings) => void
  setVisibleTabs: (tabs: string[]) => void
  effectiveAllergens: string[]
  effectiveCustomAllergens: string[]
  savedRecipes: Recipe[]
  saveRecipe: (recipe: Recipe) => void
  unsaveRecipe: (recipeId: string) => void
  isRecipeSaved: (recipeId: string) => boolean
  recipeHistory: HistoryEntry[]
  addToHistory: (entry: HistoryEntry) => void
  hasCompletedOnboarding: boolean
  completeOnboarding: () => void
  isLoadingProfile: boolean
  collections: Collection[]
  createCollection: (name: string) => void
  deleteCollection: (collectionId: string) => void
  addToCollection: (collectionId: string, recipeId: string) => void
  removeFromCollection: (collectionId: string, recipeId: string) => void
}

const FableContext = createContext<FableContextType | undefined>(undefined)

// migrateIngredients, itemToCollection, itemToRecipe imported from @/lib/data-mappers

export function FableProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    allergens: [],
    customAllergens: [],
    ingredients: [] as IngredientItem[],
    savedRecipes: [],
    safeIngredients: [],
    safeFoodsMode: false,
    showMacros: false,
    activePresets: [],
    lactoseIntolerant: false,
    lactoseMode: 'include' as const,
    kitchenEquipment: ['hob', 'oven'],
    darkMode: false,
    discoverSettings: { ...DEFAULT_DISCOVER_SETTINGS },
    visibleTabs: [...ALL_TABS], // includes 'discover' by default
  })
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([])
  const [recipeHistory, setRecipeHistory] = useState<HistoryEntry[]>([])
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [collections, setCollections] = useState<Collection[]>([])

  const { data: session, isPending } = useSession()
  const isSignedIn = !!session?.user
  const prevSignedInRef = useRef<boolean | undefined>(undefined)

  const userIdRef = useRef<string>('')
  const collectionsRef = useRef<Collection[]>([])
  useEffect(() => { collectionsRef.current = collections }, [collections])

  // ── Shared profile loader — used by init and auth-state watcher ─────────────
  const loadProfile = useCallback(async (uid: string) => {
    setIsLoadingProfile(true)
    try {
      const [profileRes, savedRes, collectionsRes] = await Promise.all([
        fetch(`/api/user/profile?userId=${uid}`),
        fetch(`/api/user/saved-recipes?userId=${uid}`),
        fetch(`/api/user/collections?userId=${uid}`),
      ])

      if (profileRes.ok) {
        const profile: {
          allergens?: string[]
          customAllergens?: string[]
          ingredients?: (string | IngredientItem)[]
          safeIngredients?: string[]
          safeFoodsMode?: boolean
          showMacros?: boolean
          activePresets?: string[]
          lactoseIntolerant?: boolean
          lactoseMode?: 'include' | 'exclude'
          kitchenEquipment?: string[]
          darkMode?: boolean
          discoverSettings?: DiscoverSettings
          visibleTabs?: string[]
        } = await profileRes.json()
        if (
          profile.allergens !== undefined ||
          profile.ingredients !== undefined ||
          profile.activePresets !== undefined ||
          profile.lactoseIntolerant !== undefined
        ) {
          setPreferences(prev => ({
            ...prev,
            allergens: profile.allergens ?? prev.allergens,
            customAllergens: profile.customAllergens ?? prev.customAllergens,
            ingredients: migrateIngredients(profile.ingredients) ?? prev.ingredients,
            safeIngredients: profile.safeIngredients ?? prev.safeIngredients,
            safeFoodsMode: profile.safeFoodsMode ?? prev.safeFoodsMode,
            showMacros: profile.showMacros ?? prev.showMacros,
            activePresets: profile.activePresets ?? prev.activePresets,
            lactoseIntolerant: profile.lactoseIntolerant ?? prev.lactoseIntolerant,
            lactoseMode: profile.lactoseMode ?? prev.lactoseMode,
            kitchenEquipment: profile.kitchenEquipment ?? prev.kitchenEquipment,
            darkMode: profile.darkMode ?? prev.darkMode,
            discoverSettings: profile.discoverSettings ?? prev.discoverSettings,
            visibleTabs: profile.visibleTabs ?? prev.visibleTabs,
          }))
          setHasCompletedOnboarding(true)
        }
      }

      if (savedRes.ok) {
        const data: { recipes: Record<string, unknown>[] } = await savedRes.json()
        const recipes = data.recipes?.length ? data.recipes.map(itemToRecipe) : []
        setSavedRecipes(recipes)
        setPreferences(prev => ({
          ...prev,
          savedRecipes: recipes.map(r => r.id),
        }))
      }

      if (collectionsRes.ok) {
        const data: { collections: Record<string, unknown>[] } = await collectionsRes.json()
        setCollections(data.collections?.length ? data.collections.map(itemToCollection) : [])
      }
    } catch (err) {
      console.error('Failed to load profile from DynamoDB:', err)
    } finally {
      setIsLoadingProfile(false)
    }
  }, [])

  // ── Initialise: load userId + fetch profile ──────────────────────────────────
  useEffect(() => {
    let uid = localStorage.getItem('fable_user_id')
    if (!uid) {
      uid = crypto.randomUUID()
      localStorage.setItem('fable_user_id', uid)
      userIdRef.current = uid
      setIsLoadingProfile(false)
      return
    }
    userIdRef.current = uid
    void loadProfile(uid)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to sign-in / sign-out after initial load ───────────────────────────
  useEffect(() => {
    if (isPending) return

    const nowSignedIn = isSignedIn === true

    // First time Clerk reports its state — just record it, don't react
    if (prevSignedInRef.current === undefined) {
      prevSignedInRef.current = nowSignedIn
      return
    }

    if (prevSignedInRef.current === nowSignedIn) return
    prevSignedInRef.current = nowSignedIn

    if (nowSignedIn) {
      // Signed in: reload profile — server routes use Clerk session, so the
      // correct auth profile (including migrated guest data) is returned
      void loadProfile(userIdRef.current)
    } else {
      // Signed out: reset to blank guest state immediately
      const newGuestId = localStorage.getItem('fable_user_id') ?? crypto.randomUUID()
      if (!localStorage.getItem('fable_user_id')) {
        localStorage.setItem('fable_user_id', newGuestId)
      }
      userIdRef.current = newGuestId
      setPreferences({
        allergens: [],
        customAllergens: [],
        ingredients: [],
        savedRecipes: [],
        safeIngredients: [],
        safeFoodsMode: false,
        showMacros: false,
        activePresets: [],
        lactoseIntolerant: false,
        lactoseMode: 'include',
        kitchenEquipment: ['hob', 'oven'],
        darkMode: false,
        discoverSettings: { ...DEFAULT_DISCOVER_SETTINGS },
        visibleTabs: [...ALL_TABS],
      })
      setSavedRecipes([])
      setRecipeHistory([])
      setCollections([])
      setHasCompletedOnboarding(false)
    }
  }, [isSignedIn, isPending, loadProfile])

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
            showMacros: preferences.showMacros,
            activePresets: preferences.activePresets,
            lactoseIntolerant: preferences.lactoseIntolerant,
            lactoseMode: preferences.lactoseMode,
            kitchenEquipment: preferences.kitchenEquipment,
            darkMode: preferences.darkMode,
            discoverSettings: preferences.discoverSettings,
            visibleTabs: preferences.visibleTabs,
          }),
        })
      } catch (err) {
        console.error('Failed to sync profile:', err)
      } finally {
        syncingRef.current = false
      }
    }, 1500)
    return () => clearTimeout(id)
  }, [isLoadingProfile, preferences.allergens, preferences.customAllergens, preferences.ingredients, preferences.safeIngredients, preferences.safeFoodsMode, preferences.showMacros, preferences.activePresets, preferences.lactoseIntolerant, preferences.lactoseMode, preferences.kitchenEquipment, preferences.darkMode, preferences.discoverSettings, preferences.visibleTabs])

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

  const addIngredient = useCallback((name: string, options?: {
    area?: IngredientArea
    displayName?: string
    subtype?: string
    quantity?: string
    unit?: IngredientUnit
    dateType?: IngredientDateType
    useByDate?: string
    boughtDate?: string
  }) => {
    const normalized = name.trim().toLowerCase()
    if (!normalized) return
    setPreferences(prev => {
      if (prev.ingredients.some(i => i.name === normalized)) return prev
      const item: IngredientItem = {
        id: crypto.randomUUID(),
        name: normalized,
        area: options?.area ?? 'fridge',
        addedAt: new Date().toISOString().split('T')[0],
        ...(options?.displayName ? { displayName: options.displayName } : {}),
        ...(options?.subtype ? { subtype: options.subtype } : {}),
        ...(options?.quantity ? { quantity: options.quantity } : {}),
        ...(options?.unit ? { unit: options.unit } : {}),
        ...(options?.dateType ? { dateType: options.dateType } : {}),
        ...(options?.useByDate ? { useByDate: options.useByDate } : {}),
        ...(options?.boughtDate ? { boughtDate: options.boughtDate } : {}),
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

  const setShowMacros = useCallback((active: boolean) => {
    setPreferences(prev => ({ ...prev, showMacros: active }))
  }, [])

  const togglePreset = useCallback((presetId: string) => {
    setPreferences(prev => ({
      ...prev,
      activePresets: prev.activePresets.includes(presetId)
        ? prev.activePresets.filter(id => id !== presetId)
        : [...prev.activePresets, presetId],
    }))
  }, [])

  const setLactoseIntolerant = useCallback((active: boolean) => {
    setPreferences(prev => ({ ...prev, lactoseIntolerant: active }))
  }, [])

  const setLactoseMode = useCallback((mode: 'include' | 'exclude') => {
    setPreferences(prev => ({ ...prev, lactoseMode: mode }))
  }, [])

  const setKitchenEquipment = useCallback((equipment: string[]) => {
    setPreferences(prev => ({ ...prev, kitchenEquipment: equipment }))
  }, [])

  const toggleKitchenEquipment = useCallback((item: string) => {
    setPreferences(prev => ({
      ...prev,
      kitchenEquipment: prev.kitchenEquipment.includes(item)
        ? prev.kitchenEquipment.filter(e => e !== item)
        : [...prev.kitchenEquipment, item],
    }))
  }, [])

  const setDarkMode = useCallback((dark: boolean) => {
    setPreferences(prev => ({ ...prev, darkMode: dark }))
  }, [])

  const setDiscoverSettings = useCallback((settings: DiscoverSettings) => {
    setPreferences(prev => ({ ...prev, discoverSettings: settings }))
  }, [])

  const setVisibleTabs = useCallback((tabs: string[]) => {
    if (tabs.length < 2) return
    setPreferences(prev => ({ ...prev, visibleTabs: tabs }))
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
    // Persist to DynamoDB — isSaved: true so the route omits TTL (never expires)
    if (userIdRef.current) {
      fetch('/api/user/saved-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdRef.current, recipe: { ...recipe, isSaved: true } }),
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

  // ── Collections ───────────────────────────────────────────────────────────────

  const createCollection = useCallback((name: string) => {
    const uid = userIdRef.current
    if (!uid || !name.trim()) return
    const collectionId = crypto.randomUUID()
    const now = new Date().toISOString()
    setCollections(prev => [...prev, { id: collectionId, name: name.trim(), recipeIds: [], createdAt: now, updatedAt: now }])
    fetch('/api/user/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, collectionId, name: name.trim() }),
    }).catch(err => console.error('Failed to create collection:', err))
  }, [])

  const deleteCollection = useCallback((collectionId: string) => {
    const uid = userIdRef.current
    if (!uid) return
    setCollections(prev => prev.filter(c => c.id !== collectionId))
    fetch(`/api/user/collections/${encodeURIComponent(collectionId)}?userId=${uid}`, {
      method: 'DELETE',
    }).catch(err => console.error('Failed to delete collection:', err))
  }, [])

  const addToCollection = useCallback((collectionId: string, recipeId: string) => {
    const uid = userIdRef.current
    if (!uid) return
    const current = collectionsRef.current.find(c => c.id === collectionId)
    if (!current || current.recipeIds.includes(recipeId)) return
    const newRecipeIds = [...current.recipeIds, recipeId]
    setCollections(prev => prev.map(c => c.id === collectionId
      ? { ...c, recipeIds: newRecipeIds, updatedAt: new Date().toISOString() }
      : c
    ))
    fetch(`/api/user/collections/${encodeURIComponent(collectionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, recipeIds: newRecipeIds }),
    }).catch(err => console.error('Failed to update collection:', err))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const removeFromCollection = useCallback((collectionId: string, recipeId: string) => {
    const uid = userIdRef.current
    if (!uid) return
    const current = collectionsRef.current.find(c => c.id === collectionId)
    if (!current) return
    const newRecipeIds = current.recipeIds.filter(id => id !== recipeId)
    setCollections(prev => prev.map(c => c.id === collectionId
      ? { ...c, recipeIds: newRecipeIds, updatedAt: new Date().toISOString() }
      : c
    ))
    fetch(`/api/user/collections/${encodeURIComponent(collectionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, recipeIds: newRecipeIds }),
    }).catch(err => console.error('Failed to update collection:', err))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── History (session-only) ───────────────────────────────────────────────────

  const addToHistory = useCallback((entry: HistoryEntry) => {
    setRecipeHistory(prev => [entry, ...prev])
    // Persist to DynamoDB with isSaved: false so the route attaches a 90-day TTL.
    // If the user later saves the recipe, the PUT with the same recipeId and
    // isSaved: true will overwrite this record and clear the TTL.
    if (userIdRef.current) {
      fetch('/api/user/saved-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userIdRef.current,
          recipe: {
            id: entry.id,
            title: entry.recipe.title,
            description: entry.recipe.description,
            image: '',
            cookTime: entry.recipe.cookTime,
            servings: entry.recipe.servings,
            matchScore: 100,
            allergens: [],
            ingredients: entry.recipe.ingredients.map(i => i.name),
            isSaved: false,
            fullRecipe: entry.recipe,
          },
        }),
      }).catch(err => console.error('Failed to persist history entry:', err))
    }
  }, [])

  // ── Computed effective restriction sets ─────────────────────────────────────
  // Merges user-explicit + preset-derived exclusions so API calls and UI
  // filtering use a single consistent set without mutating stored preferences.

  const effectiveAllergens: string[] = preferences.lactoseIntolerant && preferences.lactoseMode === 'exclude' && !preferences.allergens.includes('milk')
    ? [...preferences.allergens, 'milk']
    : preferences.allergens

  const effectiveCustomAllergens: string[] = (() => {
    const presetIngredients = preferences.activePresets.flatMap(id => DIET_PRESETS[id]?.ingredients ?? [])
    return [...new Set([...preferences.customAllergens, ...presetIngredients])]
  })()

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
        setShowMacros,
        togglePreset,
        setLactoseIntolerant,
        setLactoseMode,
        setKitchenEquipment,
        toggleKitchenEquipment,
        setDarkMode,
        setDiscoverSettings,
        setVisibleTabs,
        effectiveAllergens,
        effectiveCustomAllergens,
        savedRecipes,
        saveRecipe,
        unsaveRecipe,
        isRecipeSaved,
        recipeHistory,
        addToHistory,
        hasCompletedOnboarding,
        completeOnboarding,
        isLoadingProfile,
        collections,
        createCollection,
        deleteCollection,
        addToCollection,
        removeFromCollection,
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
