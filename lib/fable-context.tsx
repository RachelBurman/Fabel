'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useSession } from '@/lib/auth-client'
import { type UserPreferences, type Recipe, type GeneratedRecipe, type HistoryEntry, type IngredientItem, type IngredientArea, type IngredientDateType, type IngredientUnit, type Collection, type DiscoverSettings, type SpiceTolerance, type Adventurousness, DIET_PRESETS, DEFAULT_DISCOVER_SETTINGS, ALL_TABS } from '@/lib/types'
import { ALCOHOL_INGREDIENT_KEYS } from '@/lib/alcohol-ingredients'
import { migrateIngredients, itemToCollection, itemToRecipe } from '@/lib/data-mappers'
import { markTutorialComplete } from '@/lib/tutorial'
import { useProfile } from '@/lib/hooks/use-profile'
import { useSavedRecipes } from '@/lib/hooks/use-saved-recipes'
import { useCollections } from '@/lib/hooks/use-collections'
import { useUpdateProfile } from '@/lib/hooks/use-update-profile'
import { useCompleteOnboarding } from '@/lib/hooks/use-complete-onboarding'
import { useSaveRecipe } from '@/lib/hooks/use-save-recipe'
import { useUnsaveRecipe } from '@/lib/hooks/use-unsave-recipe'
import { useAddToHistory } from '@/lib/hooks/use-add-to-history'
import { useCreateCollection } from '@/lib/hooks/use-create-collection'
import { useDeleteCollection } from '@/lib/hooks/use-delete-collection'
import { useUpdateCollection } from '@/lib/hooks/use-update-collection'

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
  setAlcoholMode: (mode: 'none' | 'no_cooking' | 'exclude_entirely') => void
  setKitchenEquipment: (equipment: string[]) => void
  toggleKitchenEquipment: (item: string) => void
  setColorMode: (mode: 'light' | 'dark' | 'system') => void
  setDiscoverSettings: (settings: DiscoverSettings) => void
  setVisibleTabs: (tabs: string[]) => void
  setSpiceTolerance: (v: SpiceTolerance) => void
  setAdventurousness: (v: Adventurousness) => void
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
  completeTutorial: () => void
  isLoadingProfile: boolean
  collections: Collection[]
  createCollection: (name: string) => void
  deleteCollection: (collectionId: string) => void
  addToCollection: (collectionId: string, recipeId: string) => void
  removeFromCollection: (collectionId: string, recipeId: string) => void
}

const FableContext = createContext<FableContextType | undefined>(undefined)

const BLANK_PREFERENCES: UserPreferences = {
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
  alcoholMode: 'none',
  kitchenEquipment: ['hob', 'oven'],
  colorMode: 'system',
  discoverSettings: { ...DEFAULT_DISCOVER_SETTINGS },
  visibleTabs: [...ALL_TABS],
  spiceTolerance: 'medium',
  adventurousness: 'occasional',
}

export function FableProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>({ ...BLANK_PREFERENCES })
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([])
  const [recipeHistory, setRecipeHistory] = useState<HistoryEntry[]>([])
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [tutorialComplete, setTutorialComplete] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [userId, setUserId] = useState('')

  const { data: session, isPending } = useSession()
  const isSignedIn = !!session?.user
  const prevSignedInRef = useRef<boolean | undefined>(undefined)

  const userIdRef = useRef<string>('')
  const collectionsRef = useRef<Collection[]>([])
  useEffect(() => { collectionsRef.current = collections }, [collections])

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateProfileMutation = useUpdateProfile()
  const completeOnboardingMutation = useCompleteOnboarding()
  const saveRecipeMutation = useSaveRecipe()
  const unsaveRecipeMutation = useUnsaveRecipe()
  const addToHistoryMutation = useAddToHistory()
  const createCollectionMutation = useCreateCollection()
  const deleteCollectionMutation = useDeleteCollection()
  const updateCollectionMutation = useUpdateCollection()

  // ── Queries — only enabled once userId is set ────────────────────────────────
  const profileQuery = useProfile(userId, isSignedIn)
  const savedRecipesQuery = useSavedRecipes(userId, isSignedIn)
  const collectionsQuery = useCollections(userId, isSignedIn)

  // Derive isLoadingProfile from the three queries
  const isLoadingProfile = !userId || profileQuery.isLoading || savedRecipesQuery.isLoading || collectionsQuery.isLoading

  // ── Initialise: load userId from localStorage ────────────────────────────────
  useEffect(() => {
    let uid = localStorage.getItem('fable_user_id')
    if (!uid) {
      uid = crypto.randomUUID()
      localStorage.setItem('fable_user_id', uid)
    }
    userIdRef.current = uid
    setUserId(uid)
  }, [])

  // ── Populate preferences from profile query ──────────────────────────────────
  useEffect(() => {
    const profile = profileQuery.data
    if (!profile) return
    if (
      profile.allergens !== undefined ||
      profile.ingredients !== undefined ||
      profile.activePresets !== undefined ||
      profile.lactoseIntolerant !== undefined ||
      profile.alcoholMode !== undefined
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
        alcoholMode: profile.alcoholMode ?? prev.alcoholMode,
        kitchenEquipment: profile.kitchenEquipment ?? prev.kitchenEquipment,
        colorMode: (profile.colorMode as 'light' | 'dark' | 'system' | undefined) ?? prev.colorMode,
        discoverSettings: (profile.discoverSettings as DiscoverSettings | undefined) ?? prev.discoverSettings,
        visibleTabs: profile.visibleTabs ?? prev.visibleTabs,
        spiceTolerance: (profile.spiceTolerance as SpiceTolerance | undefined) ?? prev.spiceTolerance,
        adventurousness: (profile.adventurousness as Adventurousness | undefined) ?? prev.adventurousness,
      }))
      setHasCompletedOnboarding(true)
    }
    if (profile.onboardingComplete === true) {
      markTutorialComplete()
      setTutorialComplete(true)
    }
  }, [profileQuery.data])

  // ── Populate savedRecipes from query ─────────────────────────────────────────
  useEffect(() => {
    const data = savedRecipesQuery.data
    if (!data) return
    const recipes = data.recipes?.length ? data.recipes.map(itemToRecipe) : []
    setSavedRecipes(recipes)
    setPreferences(prev => ({ ...prev, savedRecipes: recipes.map(r => r.id) }))
  }, [savedRecipesQuery.data])

  // ── Populate collections from query ──────────────────────────────────────────
  useEffect(() => {
    const data = collectionsQuery.data
    if (!data) return
    setCollections(data.collections?.length ? data.collections.map(itemToCollection) : [])
  }, [collectionsQuery.data])

  // ── React to sign-in / sign-out after initial load ───────────────────────────
  useEffect(() => {
    if (isPending) return

    const nowSignedIn = isSignedIn === true

    if (prevSignedInRef.current === undefined) {
      prevSignedInRef.current = nowSignedIn
      return
    }

    if (prevSignedInRef.current === nowSignedIn) return
    prevSignedInRef.current = nowSignedIn

    if (!nowSignedIn) {
      // Signed out: reset to blank guest state immediately
      const guestId = localStorage.getItem('fable_user_id') ?? crypto.randomUUID()
      if (!localStorage.getItem('fable_user_id')) {
        localStorage.setItem('fable_user_id', guestId)
      }
      userIdRef.current = guestId
      setPreferences({ ...BLANK_PREFERENCES })
      setSavedRecipes([])
      setRecipeHistory([])
      setCollections([])
      setHasCompletedOnboarding(false)
      setTutorialComplete(false)
      // userId state stays the same (same guest UUID) — queries refetch with isSignedIn=false
    }
    // Sign-in: queries with [userId, true] fire automatically due to isSignedIn change
  }, [isSignedIn, isPending])

  // ── Debounced auto-save: persist the full profile whenever it changes ─────────
  const syncingRef = useRef(false)
  useEffect(() => {
    if (isLoadingProfile || !userIdRef.current) return
    const id = setTimeout(async () => {
      if (syncingRef.current) return
      syncingRef.current = true
      try {
        await updateProfileMutation.mutateAsync({
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
          alcoholMode: preferences.alcoholMode,
          kitchenEquipment: preferences.kitchenEquipment,
          colorMode: preferences.colorMode,
          discoverSettings: preferences.discoverSettings,
          visibleTabs: preferences.visibleTabs,
          spiceTolerance: preferences.spiceTolerance,
          adventurousness: preferences.adventurousness,
          onboardingComplete: tutorialComplete,
        })
      } catch (err) {
        console.error('Failed to sync profile:', err)
      } finally {
        syncingRef.current = false
      }
    }, 1500)
    return () => clearTimeout(id)
  }, [isLoadingProfile, preferences.allergens, preferences.customAllergens, preferences.ingredients, preferences.safeIngredients, preferences.safeFoodsMode, preferences.showMacros, preferences.activePresets, preferences.lactoseIntolerant, preferences.lactoseMode, preferences.alcoholMode, preferences.kitchenEquipment, preferences.colorMode, preferences.discoverSettings, preferences.visibleTabs, preferences.spiceTolerance, preferences.adventurousness, tutorialComplete]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const setAlcoholMode = useCallback((mode: 'none' | 'no_cooking' | 'exclude_entirely') => {
    setPreferences(prev => ({ ...prev, alcoholMode: mode }))
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

  const setColorMode = useCallback((mode: 'light' | 'dark' | 'system') => {
    setPreferences(prev => ({ ...prev, colorMode: mode }))
  }, [])

  const setDiscoverSettings = useCallback((settings: DiscoverSettings) => {
    setPreferences(prev => ({ ...prev, discoverSettings: settings }))
  }, [])

  const setVisibleTabs = useCallback((tabs: string[]) => {
    if (tabs.length < 2) return
    setPreferences(prev => ({ ...prev, visibleTabs: tabs }))
  }, [])

  const setSpiceTolerance = useCallback((v: SpiceTolerance) => {
    setPreferences(prev => ({ ...prev, spiceTolerance: v }))
  }, [])

  const setAdventurousness = useCallback((v: Adventurousness) => {
    setPreferences(prev => ({ ...prev, adventurousness: v }))
  }, [])

  // ── Saved recipes ─────────────────────────────────────────────────────────────

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
    if (userIdRef.current) {
      saveRecipeMutation
        .mutateAsync({ userId: userIdRef.current, recipe: { ...recipe, isSaved: true } as unknown as Record<string, unknown> })
        .catch(err => console.error('Failed to persist saved recipe:', err))
    }
  }, [saveRecipeMutation])

  const unsaveRecipe = useCallback((recipeId: string) => {
    setSavedRecipes(prev => prev.filter(r => r.id !== recipeId))
    setPreferences(prev => ({
      ...prev,
      savedRecipes: prev.savedRecipes.filter(id => id !== recipeId),
    }))
    if (userIdRef.current) {
      unsaveRecipeMutation
        .mutateAsync({ recipeId, userId: userIdRef.current })
        .catch(err => console.error('Failed to delete saved recipe:', err))
    }
  }, [unsaveRecipeMutation])

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
    createCollectionMutation
      .mutateAsync({ userId: uid, collectionId, name: name.trim() })
      .catch(err => console.error('Failed to create collection:', err))
  }, [createCollectionMutation])

  const deleteCollection = useCallback((collectionId: string) => {
    const uid = userIdRef.current
    if (!uid) return
    setCollections(prev => prev.filter(c => c.id !== collectionId))
    deleteCollectionMutation
      .mutateAsync({ collectionId, userId: uid })
      .catch(err => console.error('Failed to delete collection:', err))
  }, [deleteCollectionMutation])

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
    updateCollectionMutation
      .mutateAsync({ collectionId, userId: uid, recipeIds: newRecipeIds })
      .catch(err => console.error('Failed to update collection:', err))
  }, [updateCollectionMutation]) // eslint-disable-line react-hooks/exhaustive-deps

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
    updateCollectionMutation
      .mutateAsync({ collectionId, userId: uid, recipeIds: newRecipeIds })
      .catch(err => console.error('Failed to remove from collection:', err))
  }, [updateCollectionMutation]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── History ───────────────────────────────────────────────────────────────────

  const addToHistory = useCallback((entry: HistoryEntry) => {
    setRecipeHistory(prev => [entry, ...prev])
    if (userIdRef.current) {
      addToHistoryMutation
        .mutateAsync({
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
        })
        .catch(err => console.error('Failed to persist history entry:', err))
    }
  }, [addToHistoryMutation])

  // ── Computed effective restriction sets ──────────────────────────────────────

  const effectiveAllergens: string[] = preferences.lactoseIntolerant && preferences.lactoseMode === 'exclude' && !preferences.allergens.includes('milk')
    ? [...preferences.allergens, 'milk']
    : preferences.allergens

  const effectiveCustomAllergens: string[] = (() => {
    const presetIngredients = preferences.activePresets.flatMap(id => DIET_PRESETS[id]?.ingredients ?? [])
    const alcoholIngredients = preferences.alcoholMode === 'exclude_entirely' ? [...ALCOHOL_INGREDIENT_KEYS] : []
    return [...new Set([...preferences.customAllergens, ...presetIngredients, ...alcoholIngredients])]
  })()

  // ── Onboarding ────────────────────────────────────────────────────────────────

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true)
  }, [])

  const completeTutorial = useCallback(() => {
    markTutorialComplete()
    setTutorialComplete(true)
    if (isSignedIn && userIdRef.current) {
      completeOnboardingMutation
        .mutateAsync({ userId: userIdRef.current, onboardingComplete: true })
        .catch(err => console.error('Failed to mark onboarding complete:', err))
    }
  }, [isSignedIn, completeOnboardingMutation])

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
        setAlcoholMode,
        setKitchenEquipment,
        toggleKitchenEquipment,
        setColorMode,
        setDiscoverSettings,
        setVisibleTabs,
        setSpiceTolerance,
        setAdventurousness,
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
        completeTutorial,
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
