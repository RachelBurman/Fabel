'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { type Recipe } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Clock, Users, Heart, Trash2, BookmarkX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SavedRecipeCardProps {
  recipe: Recipe
  index: number
  onRemove: (id: string) => void
  onView: (recipe: Recipe) => void
}

function SavedRecipeCard({ recipe, index, onRemove, onView }: SavedRecipeCardProps) {
  const canView = Boolean(recipe.fullRecipe)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      layout
      onClick={canView ? () => onView(recipe) : undefined}
      className={cn(
        'group bg-card border border-border rounded-2xl overflow-hidden transition-shadow duration-300',
        canView ? 'cursor-pointer hover:shadow-lg hover:border-primary/30' : ''
      )}
    >
      {/* Image Placeholder */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/20 to-secondary overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl opacity-50">🍽️</span>
        </div>

        {/* Saved Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full">
          <Heart className="w-4 h-4 fill-current" />
          <span className="text-sm font-medium">Saved</span>
        </div>

        {/* Remove Button — stopPropagation so it doesn't trigger card click */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(recipe.id) }}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-all duration-200 border border-border"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className={cn(
          'text-lg font-semibold text-foreground mb-2 text-balance transition-colors',
          canView && 'group-hover:text-primary'
        )}>
          {recipe.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {recipe.description}
        </p>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{recipe.cookTime}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>{recipe.servings} servings</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface SavedRecipesScreenProps {
  onBack: () => void
  onViewRecipe: (recipe: Recipe) => void
}

export function SavedRecipesScreen({ onBack, onViewRecipe }: SavedRecipesScreenProps) {
  const { savedRecipes, unsaveRecipe } = useFable()

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Heart className="w-6 h-6 text-primary fill-primary" />
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground text-balance">
                Saved Recipes
              </h1>
            </div>
            <p className="text-muted-foreground">
              {savedRecipes.length === 0
                ? 'No saved recipes yet'
                : `${savedRecipes.length} recipe${savedRecipes.length > 1 ? 's' : ''} saved`}
            </p>
          </div>

          {savedRecipes.length > 0 ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {savedRecipes.map((recipe, index) => (
                  <SavedRecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    index={index}
                    onRemove={unsaveRecipe}
                    onView={onViewRecipe}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <BookmarkX className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No saved recipes yet
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                When you find recipes you love, save them here for quick access later
              </p>
              <Button onClick={onBack} className="rounded-full">
                Find Recipes
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
