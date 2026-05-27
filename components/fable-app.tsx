'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FableProvider, useFable } from '@/lib/fable-context'
import { fetchRecipeSuggestions } from '@/lib/api'
import { type Recipe } from '@/lib/types'
import { OnboardingScreen } from '@/components/onboarding-screen'
import { IngredientsScreen } from '@/components/ingredients-screen'
import { RecipeResultsScreen } from '@/components/recipe-results-screen'
import { SavedRecipesScreen } from '@/components/saved-recipes-screen'
import { BottomNavigation, Header } from '@/components/navigation'

type Screen = 'onboarding' | 'ingredients' | 'results' | 'saved'

function FableAppContent() {
  const { hasCompletedOnboarding, preferences } = useFable()
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false)

  // Set initial screen based on onboarding status
  useEffect(() => {
    if (hasCompletedOnboarding && currentScreen === 'onboarding') {
      setCurrentScreen('ingredients')
    }
  }, [hasCompletedOnboarding, currentScreen])

  const handleOnboardingComplete = () => {
    setCurrentScreen('ingredients')
  }

  const handleFindRecipes = useCallback(async () => {
    setIsLoadingRecipes(true)
    setCurrentScreen('results')
    
    try {
      const results = await fetchRecipeSuggestions(
        preferences.allergens,
        preferences.ingredients
      )
      setRecipes(results)
    } catch (error) {
      console.error('Error fetching recipes:', error)
      setRecipes([])
    } finally {
      setIsLoadingRecipes(false)
    }
  }, [preferences.allergens, preferences.ingredients])

  const handleNavigate = (screen: 'ingredients' | 'results' | 'saved') => {
    setCurrentScreen(screen)
  }

  const showNavigation = currentScreen !== 'onboarding'

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
              <IngredientsScreen onFindRecipes={handleFindRecipes} />
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
          currentScreen={currentScreen as 'ingredients' | 'results' | 'saved'}
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
