'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSession } from '@/lib/auth-client'
import { AuthForm } from '@/components/auth-form'
import { FableProvider, useFable } from '@/lib/fable-context'
import { getInsightProfileKey } from '@/lib/insight-profile'
import { type SurveyResponse } from '@/lib/survey-signals'
import { type GeneratedRecipe, type HistoryEntry, type PairingSuggestion, type IngredientItem, type RecipeBrief, type RecipeSuggestion } from '@/lib/types'
import { shouldShowTutorial, clearTutorialComplete } from '@/lib/tutorial'
import { OnboardingScreen } from '@/components/onboarding-screen'
import { IngredientsScreen, type RecipeFilters } from '@/components/ingredients-screen'
import { AllergenScreen } from '@/components/allergen-screen'
import { PairingsScreen } from '@/components/pairings-screen'
import { GeneratedRecipeScreen, type LoadingStep } from '@/components/generated-recipe-screen'
import { HistoryScreen } from '@/components/history-screen'
import { SavedRecipesScreen } from '@/components/saved-recipes-screen'
import { SafeFoodsScreen } from '@/components/safe-foods-screen'
import { SubstitutesScreen } from '@/components/substitutes-screen'
import { DiscoverSection } from '@/components/discover-section'
import { BottomNavigation, SidebarNavigation, Header } from '@/components/navigation'
import { TutorialOverlay } from '@/components/tutorial-overlay'

type Screen =
  | 'onboarding'
  | 'allergens'
  | 'safe-foods'
  | 'ingredients'
  | 'pairings'
  | 'generated'
  | 'history'
  | 'saved'
  | 'substitutes'
  | 'discover'

function FableAppContent() {
  const { hasCompletedOnboarding, isLoadingProfile, completeTutorial, preferences, addIngredient, addToHistory, saveRecipe, unsaveRecipe, effectiveAllergens, effectiveCustomAllergens } = useFable()
  const { setTheme } = useTheme()
  const { data: session } = useSession()
  const isSignedIn = !!session?.user

  // All hooks must be declared before any early return (Rules of Hooks)
  const [showTutorial, setShowTutorial] = useState(false)
  const [authOverlayOpen, setAuthOverlayOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => {
    if (isSignedIn) {
      setAuthOverlayOpen(false)
    } else {
      // Clear auth user's session data for privacy — fires on sign-out and on initial guest load
      // (initial load is a no-op since all these are already at their default values)
      setGeneratedRecipe(null)
      setGeneratedRecipeId('')
      setBrief(null)
      setPairings([])
      setLoadingStep(null)
      setRecipeAttempted(false)
      setGuestMode(false)
      setRateLimitInfo(null)
      setMacrosRateLimitMsg(null)
      setDislikedPatterns([])
      setDislikedIngredients([])
      setSubstituteIngredient(undefined)
      setSubstituteContext(undefined)
      discoverSeedIngredientsRef.current = []
      discoverSuggestionRef.current = null
    }
  }, [isSignedIn])
  const openAuth = useCallback(() => setAuthOverlayOpen(true), [])

  useEffect(() => {
    if (isLoadingProfile) return
    if (shouldShowTutorial()) setShowTutorial(true)
  }, [isLoadingProfile])

  const handleRestartTutorial = useCallback(() => {
    clearTutorialComplete()
    setShowTutorial(true)
  }, [])

  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding')
  const [prevScreen, setPrevScreen] = useState<Screen>('ingredients')

  const [pairings, setPairings] = useState<PairingSuggestion[]>([])
  const [isLoadingPairings, setIsLoadingPairings] = useState(false)
  const [recipeFilters, setRecipeFilters] = useState<RecipeFilters>({ mealType: 'main', cookTime: 'medium', kitchenOnly: false, cuisine: '', occasion: '', servings: 2 })

  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null)
  const [generatedRecipeId, setGeneratedRecipeId] = useState('')
  const [loadingStep, setLoadingStep] = useState<LoadingStep | null>(null)
  const [brief, setBrief] = useState<RecipeBrief | null>(null)
  const [generatedRecipeSaved, setGeneratedRecipeSaved] = useState(false)
  const [recipeAttempted, setRecipeAttempted] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState<{ hourRemaining: number; dayRemaining: number; resetAt: string } | null>(null)
  const [macrosRateLimitMsg, setMacrosRateLimitMsg] = useState<string | null>(null)
  const [guestMode, setGuestMode] = useState(false)

  const [dislikedPatterns, setDislikedPatterns] = useState<string[]>([])
  const [dislikedIngredients, setDislikedIngredients] = useState<string[]>([])

  const [substituteIngredient, setSubstituteIngredient] = useState<string | undefined>(undefined)
  const [substituteContext, setSubstituteContext] = useState<string[] | undefined>(undefined)

  const discoverSeedIngredientsRef = useRef<string[]>([])
  const discoverSuggestionRef = useRef<RecipeSuggestion | null>(null)

  useEffect(() => {
    if (hasCompletedOnboarding && currentScreen === 'onboarding') {
      setCurrentScreen('ingredients')
    }
  }, [hasCompletedOnboarding, currentScreen])

  // Sync colour mode from DynamoDB once profile finishes loading
  useEffect(() => {
    if (!isLoadingProfile) {
      setTheme(preferences.colorMode)
    }
  }, [isLoadingProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load recent disliked patterns to influence future generation
  useEffect(() => {
    if (isLoadingProfile) return
    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    if (!uid) return
    fetch(`/api/feedback?userId=${uid}&liked=false&limit=5`)
      .then(res => res.ok ? res.json() : null)
      .then((data: { patterns?: string[]; ingredients?: string[] } | null) => {
        if (!data) return
        setDislikedPatterns(data.patterns ?? [])
        setDislikedIngredients(data.ingredients ?? [])
      })
      .catch(() => {})
  }, [isLoadingProfile])

  const navigate = useCallback((screen: Screen) => {
    setPrevScreen(prev => (prev !== screen ? currentScreen : prev))
    setCurrentScreen(screen)
  }, [currentScreen])

  const handleOnboardingComplete = () => setCurrentScreen('ingredients')

  // â”€â”€ Show Pairings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleShowPairings = useCallback(async (filters: RecipeFilters) => {
    setRecipeFilters(filters)
    setIsLoadingPairings(true)
    navigate('pairings')

    const sfPayload = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
      ? { safeFoodsMode: true, safeIngredients: preferences.safeIngredients }
      : {}

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: preferences.ingredients,
          allergens: effectiveAllergens,
          customAllergens: effectiveCustomAllergens,
          mode: 'avoid',
          mealType: filters.mealType,
          cookTime: filters.cookTime,
          kitchenOnly: filters.kitchenOnly,
          ...sfPayload,
        }),
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data: { suggestions: PairingSuggestion[] } = await res.json()
      setPairings(data.suggestions)
    } catch (error) {
      console.error('Error fetching pairings:', error)
      setPairings([])
    } finally {
      setIsLoadingPairings(false)
    }
  }, [preferences, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Generate Recipe from scratch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleGenerateRecipe = useCallback(async (filters: RecipeFilters) => {
    setRecipeFilters(filters)
    setGeneratedRecipe(null)
    setBrief(null)
    setGeneratedRecipeSaved(false)
    setRateLimitInfo(null)
    setGuestMode(false)
    setRecipeAttempted(true)
    setLoadingStep('pairings')
    navigate('generated')

    // Snapshot safe-foods state at call time to guarantee consistency across both fetches
    const sfPayload = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
      ? { safeFoodsMode: true, safeIngredients: preferences.safeIngredients }
      : {}

    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    const seeds = discoverSeedIngredientsRef.current
    discoverSeedIngredientsRef.current = []
    const pendingSuggestion = discoverSuggestionRef.current
    discoverSuggestionRef.current = null

    const kitchenDisplayNames = preferences.ingredients
      .map(i => i.displayName ?? i.name.replace(/_/g, ' '))

    try {
      // Run brief fetch + Epicure pairings in parallel (brief feeds into generate-recipe).
      // When a pre-computed suggestion is available from the Discover tab, skip the
      // /api/recipe-brief call and resolve immediately with the stored suggestion.
      const [briefResult, pairingsResult] = await Promise.allSettled([
        pendingSuggestion
          ? Promise.resolve({
              brief: {
                direction: pendingSuggestion.direction,
                reasoning: pendingSuggestion.reasoning,
                keyIngredients: [] as string[],
                noveltyNote: pendingSuggestion.noveltyNote,
                loadingHints: [
                  'Safe ingredients. Bold flavours. Food for everyone.',
                  'Fable uses Epicure — the largest multilingual food embedding model ever built.',
                  'The more you cook with Fable, the better it knows your taste.',
                ],
              } satisfies RecipeBrief,
            })
          : fetch('/api/recipe-brief', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: uid,
                preferences: {
                  mealType: filters.mealType,
                  cookTime: filters.cookTime,
                  cuisine: filters.cuisine,
                  occasion: filters.occasion,
                  servings: filters.servings,
                  equipment: preferences.kitchenEquipment,
                  useKitchenOnly: filters.kitchenOnly,
                  spiceTolerance: preferences.spiceTolerance,
                  adventurousness: preferences.adventurousness,
                },
                kitchenIngredients: kitchenDisplayNames,
              }),
            }).then(res => res.json() as Promise<{ brief: RecipeBrief }>),

        !filters.kitchenOnly
          ? fetch('/api/recipes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ingredients: preferences.ingredients,
                allergens: effectiveAllergens,
                customAllergens: effectiveCustomAllergens,
                mode: 'avoid',
                mealType: filters.mealType,
                cookTime: filters.cookTime,
                ...sfPayload,
              }),
            }).then(res => {
              if (!res.ok) throw new Error(`Pairings error: ${res.status}`)
              return res.json() as Promise<{ suggestions: PairingSuggestion[] }>
            })
          : Promise.resolve({ suggestions: [] } as { suggestions: PairingSuggestion[] }),
      ])

      const fetchedBrief = briefResult.status === 'fulfilled' ? briefResult.value.brief : null
      const suggestionNames = pairingsResult.status === 'fulfilled'
        ? pairingsResult.value.suggestions.map(s => s.ingredient)
        : []

      setBrief(fetchedBrief)
      setLoadingStep('recipe')

      const recipeRes = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: preferences.ingredients,
          suggestions: suggestionNames,
          allergens: effectiveAllergens,
          customAllergens: effectiveCustomAllergens,
          mealType: filters.mealType,
          cookTime: filters.cookTime,
          kitchenOnly: filters.kitchenOnly,
          cuisine: filters.cuisine,
          occasion: filters.occasion,
          servings: filters.servings,
          kitchenEquipment: preferences.kitchenEquipment,
          showMacros: preferences.showMacros,
          spiceTolerance: preferences.spiceTolerance,
          adventurousness: preferences.adventurousness,
          ...(preferences.lactoseIntolerant && preferences.lactoseMode === 'include' ? { lactoseMode: 'include' } : {}),
          ...(dislikedPatterns.length > 0 ? { dislikedPatterns } : {}),
          ...(dislikedIngredients.length > 0 ? { dislikedIngredients } : {}),
          ...(uid ? { userId: uid } : {}),
          ...(seeds.length > 0 ? { seedIngredients: seeds } : {}),
          ...sfPayload,
          ...(fetchedBrief?.direction ? {
            recipeBrief: {
              direction: fetchedBrief.direction,
              keyIngredients: fetchedBrief.keyIngredients,
            },
          } : {}),
        }),
      })
      if (!recipeRes.ok) throw new Error(`Generate error: ${recipeRes.status}`)
      const recipeData = await recipeRes.json() as GeneratedRecipe & {
        rateLimited?: boolean; guestMode?: boolean; recipe?: GeneratedRecipe;
        hourRemaining?: number; dayRemaining?: number; resetAt?: string
      }
      const recipe: GeneratedRecipe = (recipeData.rateLimited || recipeData.guestMode) && recipeData.recipe
        ? recipeData.recipe
        : recipeData as GeneratedRecipe
      if (recipeData.rateLimited) {
        setRateLimitInfo({
          hourRemaining: recipeData.hourRemaining ?? 0,
          dayRemaining: recipeData.dayRemaining ?? 0,
          resetAt: recipeData.resetAt ?? '',
        })
      }
      if (recipeData.guestMode) setGuestMode(true)
      const recipeId = Date.now().toString()
      setGeneratedRecipe(recipe)
      setGeneratedRecipeId(recipeId)
      addToHistory({ id: recipeId, recipe, timestamp: Date.now() })
    } catch (error) {
      console.error('Error generating recipe:', error)
      setGeneratedRecipe(null)
    } finally {
      setLoadingStep(null)
    }
  }, [preferences, navigate, addToHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Generate Recipe from existing pairings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleGenerateFromPairings = useCallback(async () => {
    setGeneratedRecipe(null)
    setBrief(null)
    setGeneratedRecipeSaved(false)
    setRateLimitInfo(null)
    setGuestMode(false)
    setRecipeAttempted(true)
    setLoadingStep('pairings')
    navigate('generated')

    const sfPayload = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
      ? { safeFoodsMode: true, safeIngredients: preferences.safeIngredients }
      : {}

    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    const kitchenDisplayNames = preferences.ingredients
      .map(i => i.displayName ?? i.name.replace(/_/g, ' '))

    try {
      // Fetch brief then generate — pairings are already loaded
      const briefRes = await fetch('/api/recipe-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          preferences: {
            mealType: recipeFilters.mealType,
            cookTime: recipeFilters.cookTime,
            cuisine: recipeFilters.cuisine,
            occasion: recipeFilters.occasion,
            servings: recipeFilters.servings,
            equipment: preferences.kitchenEquipment,
            useKitchenOnly: recipeFilters.kitchenOnly,
            spiceTolerance: preferences.spiceTolerance,
            adventurousness: preferences.adventurousness,
          },
          kitchenIngredients: kitchenDisplayNames,
        }),
      })
      const fetchedBrief: RecipeBrief | null = briefRes.ok
        ? ((await briefRes.json()) as { brief: RecipeBrief }).brief
        : null

      setBrief(fetchedBrief)
      setLoadingStep('recipe')

      const recipeRes = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: preferences.ingredients,
          suggestions: pairings.map(s => s.ingredient),
          allergens: effectiveAllergens,
          customAllergens: effectiveCustomAllergens,
          mealType: recipeFilters.mealType,
          cookTime: recipeFilters.cookTime,
          kitchenOnly: recipeFilters.kitchenOnly,
          cuisine: recipeFilters.cuisine,
          occasion: recipeFilters.occasion,
          servings: recipeFilters.servings,
          kitchenEquipment: preferences.kitchenEquipment,
          showMacros: preferences.showMacros,
          spiceTolerance: preferences.spiceTolerance,
          adventurousness: preferences.adventurousness,
          ...(preferences.lactoseIntolerant && preferences.lactoseMode === 'include' ? { lactoseMode: 'include' } : {}),
          ...(dislikedPatterns.length > 0 ? { dislikedPatterns } : {}),
          ...(dislikedIngredients.length > 0 ? { dislikedIngredients } : {}),
          ...(uid ? { userId: uid } : {}),
          ...sfPayload,
          ...(fetchedBrief?.direction ? {
            recipeBrief: {
              direction: fetchedBrief.direction,
              keyIngredients: fetchedBrief.keyIngredients,
            },
          } : {}),
        }),
      })
      if (!recipeRes.ok) throw new Error(`Generate error: ${recipeRes.status}`)
      const recipeData = await recipeRes.json() as GeneratedRecipe & {
        rateLimited?: boolean; guestMode?: boolean; recipe?: GeneratedRecipe;
        hourRemaining?: number; dayRemaining?: number; resetAt?: string
      }
      const recipe: GeneratedRecipe = (recipeData.rateLimited || recipeData.guestMode) && recipeData.recipe
        ? recipeData.recipe
        : recipeData as GeneratedRecipe
      if (recipeData.rateLimited) {
        setRateLimitInfo({
          hourRemaining: recipeData.hourRemaining ?? 0,
          dayRemaining: recipeData.dayRemaining ?? 0,
          resetAt: recipeData.resetAt ?? '',
        })
      }
      if (recipeData.guestMode) setGuestMode(true)
      const recipeId = Date.now().toString()
      setGeneratedRecipe(recipe)
      setGeneratedRecipeId(recipeId)
      addToHistory({ id: recipeId, recipe, timestamp: Date.now() })
    } catch (error) {
      console.error('Error generating recipe from pairings:', error)
      setGeneratedRecipe(null)
    } finally {
      setLoadingStep(null)
    }
  }, [pairings, preferences, navigate, addToHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Save generated recipe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSaveGeneratedRecipe = useCallback(() => {
    if (!generatedRecipe) return
    if (generatedRecipeSaved) {
      unsaveRecipe(generatedRecipeId)
      setGeneratedRecipeSaved(false)
      return
    }
    // Use generatedRecipeId (same as the history entry's id) so the DynamoDB PUT
    // overwrites the history record — replacing isSaved: false + ttl with
    // isSaved: true and no ttl, which clears the expiry.
    saveRecipe({
      id: generatedRecipeId,
      title: generatedRecipe.title,
      description: generatedRecipe.description,
      image: '',
      cookTime: generatedRecipe.cookTime,
      servings: generatedRecipe.servings,
      matchScore: 100,
      allergens: [],
      ingredients: generatedRecipe.ingredients.map(i => i.name),
      fullRecipe: generatedRecipe,
    })
    setGeneratedRecipeSaved(true)
  }, [generatedRecipe, generatedRecipeSaved, generatedRecipeId, saveRecipe, unsaveRecipe])

  // â”€â”€ Generate recipe from an adapted ingredient list (substitutes screen) â”€â”€â”€â”€â”€
  const handleAdaptAndCook = useCallback(async (adaptedIngredientNames: string[], recipeContext?: string) => {
    setGeneratedRecipe(null)
    setGeneratedRecipeSaved(false)
    setRateLimitInfo(null)
    setGuestMode(false)
    setRecipeAttempted(true)
    setLoadingStep('recipe')
    navigate('generated')

    const items: IngredientItem[] = adaptedIngredientNames.map((name) => ({
      id: crypto.randomUUID(),
      name,
      area: 'fridge' as const,
      addedAt: new Date().toISOString().split('T')[0],
    }))

    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: items,
          suggestions: [],
          allergens: effectiveAllergens,
          customAllergens: effectiveCustomAllergens,
          mealType: 'main',
          cookTime: 'medium',
          kitchenOnly: true,
          showMacros: preferences.showMacros,
          spiceTolerance: preferences.spiceTolerance,
          adventurousness: preferences.adventurousness,
          ...(preferences.lactoseIntolerant && preferences.lactoseMode === 'include' ? { lactoseMode: 'include' } : {}),
          ...(recipeContext ? { recipeContext } : {}),
        }),
      })
      if (!res.ok) throw new Error(`Generate error: ${res.status}`)
      const recipeData = await res.json() as GeneratedRecipe & {
        rateLimited?: boolean; guestMode?: boolean; recipe?: GeneratedRecipe;
        hourRemaining?: number; dayRemaining?: number; resetAt?: string
      }
      const recipe: GeneratedRecipe = (recipeData.rateLimited || recipeData.guestMode) && recipeData.recipe
        ? recipeData.recipe
        : recipeData as GeneratedRecipe
      if (recipeData.rateLimited) {
        setRateLimitInfo({
          hourRemaining: recipeData.hourRemaining ?? 0,
          dayRemaining: recipeData.dayRemaining ?? 0,
          resetAt: recipeData.resetAt ?? '',
        })
      }
      if (recipeData.guestMode) setGuestMode(true)
      const recipeId = Date.now().toString()
      setGeneratedRecipe(recipe)
      setGeneratedRecipeId(recipeId)
      addToHistory({ id: recipeId, recipe, timestamp: Date.now() })
    } catch (error) {
      console.error('Error generating adapted recipe:', error)
      setGeneratedRecipe(null)
    } finally {
      setLoadingStep(null)
    }
  }, [preferences, navigate, addToHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Open substitutes (from ingredients screen or recipe screen) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleOpenSubstitutes = useCallback(() => {
    setSubstituteIngredient(undefined)
    setSubstituteContext(undefined)
    navigate('substitutes')
  }, [navigate])

  const handleFindSubstitute = useCallback((ingredient: string, context: string[]) => {
    setSubstituteIngredient(ingredient)
    setSubstituteContext(context)
    navigate('substitutes')
  }, [navigate])

  // â”€â”€ Fetch macros on demand when toggle is turned on after generation â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!preferences.showMacros || !generatedRecipe || generatedRecipe.macros) return
    if (!isSignedIn) {
      setMacrosRateLimitMsg('Sign in to see nutritional information.')
      return
    }
    setMacrosRateLimitMsg(null)
    let cancelled = false
    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    fetch('/api/macros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: generatedRecipe.title,
        ingredients: generatedRecipe.ingredients,
        servings: generatedRecipe.servings,
        ...(uid ? { userId: uid } : {}),
      }),
    })
      .then(async (res) => {
        if (res.status === 429) {
          const data = await res.json().catch(() => ({})) as { resetAt?: string }
          if (!cancelled) {
            const time = data.resetAt
              ? new Date(data.resetAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
              : 'soon'
            setMacrosRateLimitMsg(`You've used your AI calls for this hour. Resets at ${time}.`)
          }
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((macros: import('@/lib/types').RecipeMacros | null) => {
        if (cancelled || !macros) return
        setGeneratedRecipe(prev => prev ? { ...prev, macros } : prev)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [preferences.showMacros, generatedRecipeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ View a recipe from history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleViewHistoryRecipe = useCallback((entry: import('@/lib/types').HistoryEntry) => {
    setGeneratedRecipe(entry.recipe)
    setGeneratedRecipeSaved(false)
    setLoadingStep(null)
    setGeneratedRecipeId(entry.id)
    navigate('generated')
  }, [navigate])

  // â”€â”€ View a saved recipe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSurveySubmit = useCallback((surveyResponse: SurveyResponse) => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    if (!uid || !generatedRecipeId) return
    fetch('/api/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, recipeId: generatedRecipeId, surveyResponse }),
    }).catch(err => console.error('Failed to submit survey:', err))
  }, [generatedRecipeId])

  const handleViewSavedRecipe = useCallback((recipe: import('@/lib/types').Recipe) => {
    if (!recipe.fullRecipe) return
    setGeneratedRecipe(recipe.fullRecipe)
    setGeneratedRecipeSaved(true)
    setLoadingStep(null)
    setGeneratedRecipeId(recipe.id)
    navigate('generated')
  }, [navigate])

  // â”€â”€ Recipe feedback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleFeedback = useCallback((liked: boolean, reasons: string[], notes: string) => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    if (!uid || !generatedRecipeId || !generatedRecipe) return

    const allergenProfile = getInsightProfileKey(effectiveAllergens, preferences.activePresets)
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: uid,
        recipeId: generatedRecipeId,
        liked,
        reasons,
        notes,
        recipeTitle: generatedRecipe.title,
        recipeIngredients: generatedRecipe.ingredients.map(i => i.name),
        allergenProfile,
      }),
    }).catch(err => console.error('Failed to submit feedback:', err))

    if (!liked) {
      setDislikedPatterns(prev => [...new Set([...prev, ...reasons])].slice(0, 10))
      setDislikedIngredients(prev =>
        [...new Set([...prev, ...generatedRecipe.ingredients.map(i => i.name)])].slice(0, 20)
      )
    }
  }, [generatedRecipeId, generatedRecipe]) // eslint-disable-line react-hooks/exhaustive-deps

  const { recipeHistory } = useFable()

  const showNavigation = currentScreen !== 'onboarding' && currentScreen !== 'allergens' && currentScreen !== 'safe-foods'

  const navScreenMap: Record<Screen, 'ingredients' | 'recipe' | 'discover' | 'substitutes' | 'saved' | 'history'> = {
    onboarding:    'ingredients',
    allergens:     'ingredients',
    'safe-foods':  'ingredients',
    ingredients:   'ingredients',
    pairings:      'ingredients',
    generated:     'recipe',
    history:       'history',
    saved:         'saved',
    substitutes:   'substitutes',
    discover:      'discover',
  }

  const handleNavigate = (screen: 'ingredients' | 'recipe' | 'discover' | 'substitutes' | 'saved' | 'history') => {
    if (screen === 'recipe') {
      navigate('generated')
    } else if (screen === 'substitutes') {
      handleOpenSubstitutes()
    } else {
      navigate(screen)
    }
  }

  const tutorialOverlay = (
    <AnimatePresence>
      {showTutorial && (
        <TutorialOverlay onDismiss={() => { completeTutorial(); setShowTutorial(false) }} />
      )}
    </AnimatePresence>
  )

  if (isLoadingProfile) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        {tutorialOverlay}
      </>
    )
  }

  return (
    <>
    <div className={`h-dvh flex flex-col bg-background${showNavigation ? ' md:ml-[220px]' : ''}`}>
      {showNavigation && (
        <SidebarNavigation
          currentScreen={navScreenMap[currentScreen]}
          onNavigate={handleNavigate}
        />
      )}
      {showNavigation && (
        <Header onSettingsClick={() => navigate('allergens')} />
      )}

      <main className={`flex-1 min-h-0 overflow-y-auto${showNavigation ? ' pb-16 md:pb-0' : ''}`}>
        <AnimatePresence mode="wait">

          {currentScreen === 'onboarding' && (
            <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <OnboardingScreen onComplete={handleOnboardingComplete} />
            </motion.div>
          )}

          {currentScreen === 'allergens' && (
            <motion.div
              key="allergens"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
            >
              <AllergenScreen
                onDone={() => navigate(prevScreen === 'allergens' ? 'ingredients' : prevScreen)}
                onManageSafeFoods={() => navigate('safe-foods')}
                onRestartTutorial={handleRestartTutorial}
                onOpenAuth={openAuth}
              />
            </motion.div>
          )}

          {currentScreen === 'safe-foods' && (
            <motion.div
              key="safe-foods"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SafeFoodsScreen
                fullPage
                onBack={() => navigate('allergens')}
                onDone={() => navigate('allergens')}
                doneLabel="Done"
              />
            </motion.div>
          )}

          {currentScreen === 'ingredients' && (
            <motion.div
              key="ingredients"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <IngredientsScreen
                onShowPairings={handleShowPairings}
                onGenerateRecipe={handleGenerateRecipe}
                onFindSubstitutes={handleOpenSubstitutes}
                onOpenAuth={openAuth}
              />
            </motion.div>
          )}

          {currentScreen === 'pairings' && (
            <motion.div
              key="pairings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PairingsScreen
                suggestions={pairings}
                isLoading={isLoadingPairings}
                onBack={() => navigate('ingredients')}
                onAddIngredient={addIngredient}
                onGenerateFromPairings={handleGenerateFromPairings}
              />
            </motion.div>
          )}

          {currentScreen === 'generated' && (
            <motion.div
              key="generated"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <GeneratedRecipeScreen
                recipe={generatedRecipe}
                recipeId={generatedRecipeId}
                loadingStep={loadingStep}
                brief={brief}
                onBack={() => navigate(prevScreen)}
                onSave={handleSaveGeneratedRecipe}
                isSaved={generatedRecipeSaved}
                attempted={recipeAttempted}
                onGoToIngredients={() => navigate('ingredients')}
                allergens={effectiveAllergens}
                onFeedback={handleFeedback}
                onSurveySubmit={handleSurveySubmit}
                showMacros={preferences.showMacros}
                onFindSubstitute={handleFindSubstitute}
                lactoseIntolerant={preferences.lactoseIntolerant}
                lactoseMode={preferences.lactoseMode}
                rateLimitInfo={rateLimitInfo}
                macrosRateLimitMsg={macrosRateLimitMsg}
                guestMode={guestMode}
                onOpenAuth={openAuth}
              />
            </motion.div>
          )}

          {currentScreen === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <HistoryScreen
                history={recipeHistory}
                onViewRecipe={handleViewHistoryRecipe}
                onGenerateNew={() => navigate('ingredients')}
                onBack={() => navigate('ingredients')}
              />

            </motion.div>
          )}

          {currentScreen === 'saved' && (
            <motion.div
              key="saved"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <SavedRecipesScreen
                onBack={() => navigate('ingredients')}
                onViewRecipe={handleViewSavedRecipe}
                onGenerateRecipe={() => navigate('generated')}
              />
            </motion.div>
          )}

          {currentScreen === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <DiscoverSection
                onSelectCuisine={(c) => setRecipeFilters((prev) => ({ ...prev, cuisine: c }))}
                onSelectOccasion={(o) => {
                  setRecipeFilters((prev) => ({ ...prev, occasion: o }))
                  navigate('ingredients')
                }}
                onSeedIngredients={(seeds) => { discoverSeedIngredientsRef.current = seeds }}
                onSelectSuggestion={(s) => {
                  discoverSuggestionRef.current = s
                  navigate('ingredients')
                }}
              />
            </motion.div>
          )}

          {currentScreen === 'substitutes' && (
            <motion.div
              key="substitutes"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <SubstitutesScreen
                onBack={() => navigate(prevScreen)}
                onNavigateToKitchen={() => navigate('ingredients')}
                initialIngredient={substituteIngredient}
                initialContext={substituteContext}
                onAdaptAndCook={handleAdaptAndCook}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {showNavigation && (
        <BottomNavigation
          currentScreen={navScreenMap[currentScreen]}
          onNavigate={handleNavigate}
        />
      )}
    </div>
    {tutorialOverlay}

    {isMounted && createPortal(
      <AnimatePresence>
        {authOverlayOpen && (
          <motion.div
            key="auth-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] flex flex-col overflow-y-auto px-5 py-6 bg-background"
          >
            <button
              onClick={() => setAuthOverlayOpen(false)}
              aria-label="Close"
              className="fixed top-4 right-4 z-[201] w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
            <div className="w-full max-w-sm mx-auto">
              <AuthForm onSuccess={() => setAuthOverlayOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  )
}

export default function FableApp() {
  return (
    <FableProvider>
      <FableAppContent />
    </FableProvider>
  )
}
