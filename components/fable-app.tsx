'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { FableProvider, useFable } from '@/lib/fable-context'
import { type GeneratedRecipe, type HistoryEntry, type PairingSuggestion, type IngredientItem } from '@/lib/types'
import { OnboardingScreen } from '@/components/onboarding-screen'
import { IngredientsScreen, type RecipeFilters } from '@/components/ingredients-screen'
import { AllergenScreen } from '@/components/allergen-screen'
import { PairingsScreen } from '@/components/pairings-screen'
import { GeneratedRecipeScreen, type LoadingStep } from '@/components/generated-recipe-screen'
import { HistoryScreen } from '@/components/history-screen'
import { SavedRecipesScreen } from '@/components/saved-recipes-screen'
import { SafeFoodsScreen } from '@/components/safe-foods-screen'
import { SubstitutesScreen } from '@/components/substitutes-screen'
import { BottomNavigation, Header } from '@/components/navigation'

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

function FableAppContent() {
  const { hasCompletedOnboarding, isLoadingProfile, preferences, addIngredient, addToHistory, saveRecipe, effectiveAllergens, effectiveCustomAllergens } = useFable()

  // All hooks must be declared before any early return (Rules of Hooks)
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding')
  const [prevScreen, setPrevScreen] = useState<Screen>('ingredients')

  const [pairings, setPairings] = useState<PairingSuggestion[]>([])
  const [isLoadingPairings, setIsLoadingPairings] = useState(false)
  const [recipeFilters, setRecipeFilters] = useState<RecipeFilters>({ mealType: 'main', cookTime: 'medium', kitchenOnly: false })

  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null)
  const [generatedRecipeId, setGeneratedRecipeId] = useState('')
  const [loadingStep, setLoadingStep] = useState<LoadingStep | null>(null)
  const [generatedRecipeSaved, setGeneratedRecipeSaved] = useState(false)
  const [recipeAttempted, setRecipeAttempted] = useState(false)

  const [dislikedPatterns, setDislikedPatterns] = useState<string[]>([])
  const [dislikedIngredients, setDislikedIngredients] = useState<string[]>([])

  const [substituteIngredient, setSubstituteIngredient] = useState<string | undefined>(undefined)
  const [substituteContext, setSubstituteContext] = useState<string[] | undefined>(undefined)

  useEffect(() => {
    if (hasCompletedOnboarding && currentScreen === 'onboarding') {
      setCurrentScreen('ingredients')
    }
  }, [hasCompletedOnboarding, currentScreen])

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
    setGeneratedRecipeSaved(false)
    setRecipeAttempted(true)
    setLoadingStep('pairings')
    navigate('generated')

    // Snapshot safe-foods state at call time to guarantee consistency across both fetches
    const sfPayload = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
      ? { safeFoodsMode: true, safeIngredients: preferences.safeIngredients }
      : {}

    try {
      // When kitchen-only, skip Epicure pairings â€” Claude will work within the listed ingredients
      let suggestionNames: string[] = []
      if (!filters.kitchenOnly) {
        const pairingsRes = await fetch('/api/recipes', {
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
        })
        if (!pairingsRes.ok) throw new Error(`Pairings error: ${pairingsRes.status}`)
        const pairingsData: { suggestions: PairingSuggestion[] } = await pairingsRes.json()
        suggestionNames = pairingsData.suggestions.map(s => s.ingredient)
      }

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
          showMacros: preferences.showMacros,
          ...(preferences.lactoseIntolerant && preferences.lactoseMode === 'include' ? { lactoseMode: 'include' } : {}),
          ...(dislikedPatterns.length > 0 ? { dislikedPatterns } : {}),
          ...(dislikedIngredients.length > 0 ? { dislikedIngredients } : {}),
          ...sfPayload,
        }),
      })
      if (!recipeRes.ok) throw new Error(`Generate error: ${recipeRes.status}`)
      const recipe: GeneratedRecipe = await recipeRes.json()
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
    setGeneratedRecipeSaved(false)
    setRecipeAttempted(true)
    setLoadingStep('recipe')
    navigate('generated')

    const sfPayload = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
      ? { safeFoodsMode: true, safeIngredients: preferences.safeIngredients }
      : {}

    try {
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
          showMacros: preferences.showMacros,
          ...(preferences.lactoseIntolerant && preferences.lactoseMode === 'include' ? { lactoseMode: 'include' } : {}),
          ...(dislikedPatterns.length > 0 ? { dislikedPatterns } : {}),
          ...(dislikedIngredients.length > 0 ? { dislikedIngredients } : {}),
          ...sfPayload,
        }),
      })
      if (!recipeRes.ok) throw new Error(`Generate error: ${recipeRes.status}`)
      const recipe: GeneratedRecipe = await recipeRes.json()
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
    saveRecipe({
      id: `gen-${Date.now()}`,
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
  }, [generatedRecipe, saveRecipe])

  // â”€â”€ Generate recipe from an adapted ingredient list (substitutes screen) â”€â”€â”€â”€â”€
  const handleAdaptAndCook = useCallback(async (adaptedIngredientNames: string[], recipeContext?: string) => {
    setGeneratedRecipe(null)
    setGeneratedRecipeSaved(false)
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
          ...(preferences.lactoseIntolerant && preferences.lactoseMode === 'include' ? { lactoseMode: 'include' } : {}),
          ...(recipeContext ? { recipeContext } : {}),
        }),
      })
      if (!res.ok) throw new Error(`Generate error: ${res.status}`)
      const recipe: GeneratedRecipe = await res.json()
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
    let cancelled = false
    fetch('/api/macros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: generatedRecipe.title,
        ingredients: generatedRecipe.ingredients,
        servings: generatedRecipe.servings,
      }),
    })
      .then(res => res.ok ? res.json() : null)
      .then((macros: import('@/lib/types').RecipeMacros | null) => {
        if (cancelled || !macros) return
        setGeneratedRecipe(prev => prev ? { ...prev, macros } : prev)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [preferences.showMacros, generatedRecipeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ View a recipe from history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleViewHistoryRecipe = useCallback((recipe: GeneratedRecipe) => {
    setGeneratedRecipe(recipe)
    setGeneratedRecipeSaved(false)
    setLoadingStep(null)
    setGeneratedRecipeId(Date.now().toString())
    navigate('generated')
  }, [navigate])

  // â”€â”€ View a saved recipe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleViewSavedRecipe = useCallback((recipe: import('@/lib/types').Recipe) => {
    if (!recipe.fullRecipe) return
    setGeneratedRecipe(recipe.fullRecipe)
    setGeneratedRecipeSaved(true)
    setLoadingStep(null)
    setGeneratedRecipeId(Date.now().toString())
    navigate('generated')
  }, [navigate])

  // â”€â”€ Recipe feedback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleFeedback = useCallback((liked: boolean, reasons: string[], notes: string) => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    if (!uid || !generatedRecipeId || !generatedRecipe) return

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

  const navScreenMap: Record<Screen, 'ingredients' | 'recipe' | 'substitutes' | 'saved' | 'history'> = {
    onboarding:    'ingredients',
    allergens:     'ingredients',
    'safe-foods':  'ingredients',
    ingredients:   'ingredients',
    pairings:      'ingredients',
    generated:     'recipe',
    history:       'history',
    saved:         'saved',
    substitutes:   'substitutes',
  }

  const handleNavigate = (screen: 'ingredients' | 'recipe' | 'substitutes' | 'saved' | 'history') => {
    if (screen === 'recipe') {
      navigate('generated')
    } else if (screen === 'substitutes') {
      handleOpenSubstitutes()
    } else {
      navigate(screen)
    }
  }

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {showNavigation && (
        <Header onSettingsClick={() => navigate('allergens')} />
      )}

      <main className={showNavigation ? 'pb-20' : ''}>
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GeneratedRecipeScreen
                recipe={generatedRecipe}
                loadingStep={loadingStep}
                onBack={() => navigate(prevScreen)}
                onSave={handleSaveGeneratedRecipe}
                isSaved={generatedRecipeSaved}
                attempted={recipeAttempted}
                onGoToIngredients={() => navigate('ingredients')}
                allergens={effectiveAllergens}
                onFeedback={handleFeedback}
                showMacros={preferences.showMacros}
                onFindSubstitute={handleFindSubstitute}
                lactoseIntolerant={preferences.lactoseIntolerant}
                lactoseMode={preferences.lactoseMode}
              />
            </motion.div>
          )}

          {currentScreen === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <HistoryScreen
                history={recipeHistory}
                onViewRecipe={handleViewHistoryRecipe}
                onGenerateNew={() => navigate('ingredients')}
              />
            </motion.div>
          )}

          {currentScreen === 'saved' && (
            <motion.div
              key="saved"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SavedRecipesScreen
                onBack={() => navigate('ingredients')}
                onViewRecipe={handleViewSavedRecipe}
              />
            </motion.div>
          )}

          {currentScreen === 'substitutes' && (
            <motion.div
              key="substitutes"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SubstitutesScreen
                onBack={() => navigate(prevScreen)}
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
  )
}

export default function FableApp() {
  return (
    <FableProvider>
      <FableAppContent />
    </FableProvider>
  )
}
