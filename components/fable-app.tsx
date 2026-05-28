'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FableProvider, useFable } from '@/lib/fable-context'
import { type Recipe, type GeneratedRecipe } from '@/lib/types'
import { OnboardingScreen } from '@/components/onboarding-screen'
import { IngredientsScreen } from '@/components/ingredients-screen'
import { RecipeResultsScreen } from '@/components/recipe-results-screen'
import { GeneratedRecipeScreen, type LoadingStep } from '@/components/generated-recipe-screen'
import { SavedRecipesScreen } from '@/components/saved-recipes-screen'
import { BottomNavigation, Header } from '@/components/navigation'

type Screen = 'onboarding' | 'ingredients' | 'results' | 'generated' | 'saved'

function FableAppContent() {
  const { hasCompletedOnboarding, preferences } = useFable()
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false)
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null)
  const [loadingStep, setLoadingStep] = useState<LoadingStep | null>(null)

  useEffect(() => {
    if (hasCompletedOnboarding && currentScreen === 'onboarding') {
      setCurrentScreen('ingredients')
    }
  }, [hasCompletedOnboarding, currentScreen])

  const handleOnboardingComplete = () => {
    setCurrentScreen('ingredients')
  }

  // Show Pairings — calls /api/recipes and displays ingredient suggestions
  const handleShowPairings = useCallback(async () => {
    setIsLoadingRecipes(true)
    setCurrentScreen('results')

    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: preferences.ingredients,
          allergens: preferences.allergens,
          mode: 'avoid',
        }),
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const data: { suggestions: { ingredient: string; score: number; allergens: string[] }[] } =
        await res.json()

      setRecipes(
        data.suggestions.map((s) => ({
          id: s.ingredient,
          title: s.ingredient.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          description:
            s.allergens.length > 0
              ? `Contains: ${s.allergens.map((a) => a.replace(/_/g, ' ')).join(', ')}`
              : 'No major allergens',
          image: '',
          cookTime: 'Ingredient suggestion',
          servings: 1,
          matchScore: Math.round(s.score * 100),
          allergens: s.allergens,
          ingredients: [s.ingredient],
        }))
      )
    } catch (error) {
      console.error('Error fetching pairings:', error)
      setRecipes([])
    } finally {
      setIsLoadingRecipes(false)
    }
  }, [preferences.allergens, preferences.ingredients])

  // Generate Recipe — calls /api/recipes then /api/generate-recipe
  const handleGenerateRecipe = useCallback(async () => {
    setGeneratedRecipe(null)
    setLoadingStep('pairings')
    setCurrentScreen('generated')

    try {
      // Step 1: get safe Epicure pairings
      const pairingsRes = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: preferences.ingredients,
          allergens: preferences.allergens,
          mode: 'avoid',
        }),
      })
      if (!pairingsRes.ok) throw new Error(`Pairings error: ${pairingsRes.status}`)
      const pairingsData: {
        suggestions: { ingredient: string; score: number; allergens: string[] }[]
      } = await pairingsRes.json()

      // Step 2: generate recipe with Claude
      setLoadingStep('recipe')
      const recipeRes = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: preferences.ingredients,
          suggestions: pairingsData.suggestions.map((s) => s.ingredient),
          allergens: preferences.allergens,
        }),
      })
      if (!recipeRes.ok) throw new Error(`Generate error: ${recipeRes.status}`)
      const recipe: GeneratedRecipe = await recipeRes.json()
      setGeneratedRecipe(recipe)
    } catch (error) {
      console.error('Error generating recipe:', error)
      setGeneratedRecipe(null)
    } finally {
      setLoadingStep(null)
    }
  }, [preferences.allergens, preferences.ingredients])

  const handleNavigate = (screen: 'ingredients' | 'results' | 'saved') => {
    setCurrentScreen(screen)
  }

  const showNavigation = currentScreen !== 'onboarding'

  // Map 'generated' → 'results' for the bottom nav highlight
  const bottomNavScreen: 'ingredients' | 'results' | 'saved' =
    currentScreen === 'generated' ? 'results' :
    currentScreen === 'onboarding' ? 'ingredients' :
    currentScreen

  return (
    <div className="min-h-screen bg-background">
      {showNavigation && <Header />}

      <main className={showNavigation ? 'pb-20' : ''}>
        <AnimatePresence mode="wait">
          {currentScreen === 'onboarding' && (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OnboardingScreen onComplete={handleOnboardingComplete} />
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

          {currentScreen === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <RecipeResultsScreen
                recipes={recipes}
                isLoading={isLoadingRecipes}
                onBack={() => setCurrentScreen('ingredients')}
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
                onBack={() => setCurrentScreen('ingredients')}
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
              <SavedRecipesScreen onBack={() => setCurrentScreen('ingredients')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showNavigation && (
        <BottomNavigation
          currentScreen={bottomNavScreen}
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
