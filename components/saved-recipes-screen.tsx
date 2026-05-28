'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { type Recipe } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Clock, Users, Heart, Trash2, BookmarkX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RecipeGradient } from '@/components/recipe-gradient'

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
      {/* Gradient image */}
      <RecipeGradient title={recipe.title} className="aspect-[4/3]">
        {/* Title overlay */}
        <div className="absolute bottom-0 inset-x-0 p-3">
          <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2 drop-shadow">
            {recipe.title}
          </h3>
        </div>

        {/* Saved badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/40 backdrop-blur-sm text-white rounded-full">
          <Heart className="w-3.5 h-3.5 fill-current" />
          <span className="text-xs font-medium">Saved</span>
        </div>

        {/* Remove button — stopPropagation so it doesn't trigger card click */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(recipe.id) }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white/80 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all duration-200"
          aria-label="Remove recipe"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </RecipeGradient>

      {/* Content */}
      <div className="p-5">
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
