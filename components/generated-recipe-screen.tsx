'use client'

import { motion } from 'framer-motion'
import { type GeneratedRecipe } from '@/lib/types'
import { Clock, Users, ArrowLeft, Check, Loader2, ShieldCheck, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type LoadingStep = 'pairings' | 'recipe'

interface GeneratedRecipeScreenProps {
  recipe: GeneratedRecipe | null
  loadingStep: LoadingStep | null
  onBack: () => void
  onSave?: () => void
  isSaved?: boolean
}

const STEPS: { key: LoadingStep; label: string }[] = [
  { key: 'pairings', label: 'Finding safe pairings' },
  { key: 'recipe', label: 'Crafting your recipe' },
]

export function GeneratedRecipeScreen({ recipe, loadingStep, onBack, onSave, isSaved }: GeneratedRecipeScreenProps) {
  const isLoading = loadingStep !== null
  const activeIndex = loadingStep === 'pairings' ? 0 : loadingStep === 'recipe' ? 1 : -1

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">

          {/* Back + title + save */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              disabled={isLoading}
              className="shrink-0 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="flex-1 text-2xl md:text-3xl font-semibold text-foreground text-balance">
              {isLoading ? 'Generating Recipe…' : recipe ? recipe.title : 'Recipe'}
            </h1>
            {!isLoading && recipe && onSave && (
              <button
                onClick={onSave}
                className={cn(
                  'shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
                  isSaved
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50'
                )}
                aria-label={isSaved ? 'Saved' : 'Save recipe'}
              >
                <Heart className={cn('w-5 h-5', isSaved && 'fill-current')} />
              </button>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-16"
            >
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-10" />
              <div className="w-full max-w-xs space-y-5">
                {STEPS.map(({ key, label }, i) => {
                  const isDone = i < activeIndex
                  const isActive = i === activeIndex
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300',
                        isDone  ? 'bg-primary text-primary-foreground' :
                        isActive ? 'bg-primary/20 text-primary' :
                                   'bg-secondary text-muted-foreground'
                      )}>
                        {isDone
                          ? <Check className="w-3.5 h-3.5" />
                          : <span className="text-xs font-semibold">{i + 1}</span>
                        }
                      </div>
                      <span className={cn(
                        'text-sm transition-colors duration-300',
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                      )}>
                        {label}{isActive && '…'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Recipe */}
          {!isLoading && recipe && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <p className="text-muted-foreground leading-relaxed text-pretty">
                {recipe.description}
              </p>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 border-y border-border text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{recipe.cookTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{recipe.servings} servings</span>
                </div>
                {recipe.allergenFree && (
                  <div className="flex items-center gap-2 text-primary">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Allergen safe</span>
                  </div>
                )}
              </div>

              {/* Ingredients */}
              <section>
                <h2 className="text-lg font-semibold text-foreground mb-4">Ingredients</h2>
                <ul className="space-y-2.5">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-foreground">
                        <span className="font-medium">{ing.amount} {ing.unit}</span>
                        {' '}{ing.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Steps */}
              <section className="pb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Method</h2>
                <ol className="space-y-5">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground leading-relaxed pt-1">{step}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </motion.div>
          )}

          {/* Error */}
          {!isLoading && !recipe && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🍳</span>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Couldn&apos;t generate a recipe
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Something went wrong. Try again or adjust your ingredients.
              </p>
              <Button onClick={onBack} variant="outline" className="rounded-full">
                Go Back
              </Button>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}
