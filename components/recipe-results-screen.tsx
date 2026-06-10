'use client'

import { motion } from 'framer-motion'
import { type Recipe } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Clock, Users, Heart, ShieldCheck, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface RecipeCardProps {
  recipe: Recipe
  index: number
}

function RecipeCard({ recipe, index }: RecipeCardProps) {
  const { saveRecipe, unsaveRecipe, isRecipeSaved } = useFable()
  const t = useTranslations('recipe')
  const isSaved = isRecipeSaved(recipe.id)

  const handleToggleSave = () => {
    if (isSaved) {
      unsaveRecipe(recipe.id)
    } else {
      saveRecipe(recipe)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300"
    >
      {/* Image Placeholder */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/20 to-secondary overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl opacity-50">🍽️</span>
        </div>
        
        {/* Match Score Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-card/90 backdrop-blur-sm rounded-full border border-border">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{t('matchScore', { score: recipe.matchScore })}</span>
        </div>

        {/* Save Button */}
        <button
          onClick={handleToggleSave}
          className={cn(
            'absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
            isSaved
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/90 backdrop-blur-sm text-muted-foreground hover:text-primary border border-border'
          )}
        >
          <Heart className={cn('w-5 h-5', isSaved && 'fill-current')} />
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors text-balance">
          {recipe.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {recipe.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{recipe.cookTime}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{t('cardServings', { count: recipe.servings })}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface RecipeResultsScreenProps {
  recipes: Recipe[]
  isLoading: boolean
  onBack: () => void
}

export function RecipeResultsScreen({ recipes, isLoading, onBack }: RecipeResultsScreenProps) {
  const { preferences } = useFable()
  const t = useTranslations('recipe')

  return (
    <div className="bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="back-btn shrink-0 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground text-balance">
                {t('yourSafeRecipes')}
              </h1>
              <p className="text-muted-foreground">
                {preferences.allergens.length > 0
                  ? preferences.allergens.length > 1
                    ? t('filteredToAvoidPlural', { count: preferences.allergens.length })
                    : t('filteredToAvoid', { count: preferences.allergens.length })
                  : t('allRecipesShown')}
              </p>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-secondary" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-secondary rounded w-3/4" />
                    <div className="h-4 bg-secondary rounded w-full" />
                    <div className="h-4 bg-secondary rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recipes.length > 0 ? (
            /* Recipe Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recipes.map((recipe, index) => (
                <RecipeCard key={recipe.id} recipe={recipe} index={index} />
              ))}
            </div>
          ) : (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center text-center min-h-[calc(100dvh-16rem)]"
            >
              <div className="text-5xl mb-6">🔍</div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{t('noRecipesFound')}</h2>
              <p className="text-muted-foreground max-w-xs mx-auto mb-8">
                {t('noRecipesFoundDesc')}
              </p>
              <Button onClick={onBack} variant="outline" className="rounded-full">{t('goBack')}</Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
