'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { FableProvider, useFable } from '@/lib/fable-context'
import { type GeneratedRecipe, type HistoryEntry, type PairingSuggestion } from '@/lib/types'
import { OnboardingScreen } from '@/components/onboarding-screen'
import { IngredientsScreen, type RecipeFilters } from '@/components/ingredients-screen'
import { AllergenScreen } from '@/components/allergen-screen'
import { PairingsScreen } from '@/components/pairings-screen'
import { GeneratedRecipeScreen, type LoadingStep } from '@/components/generated-recipe-screen'
import { HistoryScreen } from '@/components/history-screen'
import { SavedRecipesScreen } from '@/components/saved-recipes-screen'
import { SafeFoodsScreen } from '@/components/safe-foods-screen'
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

function FableAppContent() {
  const { hasCompletedOnboarding, isLoadingProfile, preferences, addIngredient, addToHistory, saveRecipe } = useFable()

  // All hooks must be declared before any early return (Rules of Hooks)
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding')
  const [prevScreen, setPrevScreen] = useState<Screen>('ingredients')

  const [pairings, setPairings] = useState<PairingSuggestion[]>([])
  const [isLoadingPairings, setIsLoadingPairings] = useState(false)
  const [recipeFilters, setRecipeFilters] = useState<RecipeFilters>({ mealType: 'main', cookTime: 'medium', kitchenOnly: false })

  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null)
  const [loadingStep, setLoadingStep] = useState<LoadingStep | null>(null)
  const [generatedRecipeSaved, setGeneratedRecipeSaved] = useState(false)
  const [recipeAttempted, setRecipeAttempted] = useState(false)

  useEffect(() => {
    if (hasCompletedOnboarding && currentScreen === 'onboarding') {
      setCurrentScreen('ingredients')
    }
  }, [hasCompletedOnboarding, currentScreen])

  const navigate = useCallback((screen: Screen) => {
    setPrevScreen(prev => (prev !== screen ? currentScreen : prev))
    setCurrentScreen(screen)
  }, [currentScreen])

  const handleOnboardingComplete = () => setCurrentScreen('ingredients')

  // ── Show Pairings ────────────────────────────────────────────────────────────
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
          allergens: preferences.allergens,
          customAllergens: preferences.customAllergens,
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

  // ── Generate Recipe from scratch ─────────────────────────────────────────────
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
      // When kitchen-only, skip Epicure pairings — Claude will work within the listed ingredients
      let suggestionNames: string[] = []
      if (!filters.kitchenOnly) {
        const pairingsRes = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredients: preferences.ingredients,
            allergens: preferences.allergens,
            customAllergens: preferences.customAllergens,
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
          allergens: preferences.allergens,
          customAllergens: preferences.customAllergens,
          mealType: filters.mealType,
          cookTime: filters.cookTime,
          kitchenOnly: filters.kitchenOnly,
          ...sfPayload,
        }),
      })
      if (!recipeRes.ok) throw new Error(`Generate error: ${recipeRes.status}`)
      const recipe: GeneratedRecipe = await recipeRes.json()
      setGeneratedRecipe(recipe)
      addToHistory({ id: Date.now().toString(), recipe, timestamp: Date.now() })
    } catch (error) {
      console.error('Error generating recipe:', error)
      setGeneratedRecipe(null)
    } finally {
      setLoadingStep(null)
    }
  }, [preferences, navigate, addToHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate Recipe from existing pairings ────────────────────────────────────
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
          allergens: preferences.allergens,
          customAllergens: preferences.customAllergens,
          mealType: recipeFilters.mealType,
          cookTime: recipeFilters.cookTime,
          kitchenOnly: recipeFilters.kitchenOnly,
          ...sfPayload,
        }),
      })
      if (!recipeRes.ok) throw new Error(`Generate error: ${recipeRes.status}`)
      const recipe: GeneratedRecipe = await recipeRes.json()
      setGeneratedRecipe(recipe)
      addToHistory({ id: Date.now().toString(), recipe, timestamp: Date.now() })
    } catch (error) {
      console.error('Error generating recipe from pairings:', error)
      setGeneratedRecipe(null)
    } finally {
      setLoadingStep(null)
    }
  }, [pairings, preferences, navigate, addToHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save generated recipe ────────────────────────────────────────────────────
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

  // ── View a recipe from history ────────────────────────────────────────────────
  const handleViewHistoryRecipe = useCallback((recipe: GeneratedRecipe) => {
    setGeneratedRecipe(recipe)
    setGeneratedRecipeSaved(false)
    setLoadingStep(null)
    navigate('generated')
  }, [navigate])

  // ── View a saved recipe ────────────────────────────────────────────────────────
  const handleViewSavedRecipe = useCallback((recipe: import('@/lib/types').Recipe) => {
    if (!recipe.fullRecipe) return
    setGeneratedRecipe(recipe.fullRecipe)
    setGeneratedRecipeSaved(true)
    setLoadingStep(null)
    navigate('generated')
  }, [navigate])

  const { recipeHistory } = useFable()

  const showNavigation = currentScreen !== 'onboarding' && currentScreen !== 'allergens' && currentScreen !== 'safe-foods'

  const navScreenMap: Record<Screen, 'ingredients' | 'recipe' | 'saved' | 'history'> = {
    onboarding:    'ingredients',
    allergens:     'ingredients',
    'safe-foods':  'ingredients',
    ingredients:   'ingredients',
    pairings:      'ingredients',
    generated:     'recipe',
    history:       'history',
    saved:         'saved',
  }

  const handleNavigate = (screen: 'ingredients' | 'recipe' | 'saved' | 'history') => {
    if (screen === 'recipe') {
      navigate('generated')
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
