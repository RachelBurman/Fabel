'use client'

import { motion } from 'framer-motion'
import { type PairingSuggestion } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { ArrowLeft, Check, Plus, ShieldCheck, AlertTriangle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { displayName } from '@/components/ingredients-screen'

interface PairingCardProps {
  suggestion: PairingSuggestion
  index: number
  isAdded: boolean
  onAdd: (ingredient: string) => void
}

function PairingCard({ suggestion, index, isAdded, onAdd }: PairingCardProps) {
  const { ingredient, score, allergens } = suggestion
  const matchPct = Math.round(score * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4"
    >
      {/* Score ring */}
      <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-primary leading-none">{matchPct}%</span>
        <span className="text-[10px] text-primary/70 leading-none mt-0.5">match</span>
      </div>

      {/* Name + allergens */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm leading-snug">
          {displayName(ingredient)}
        </p>
        {allergens.length > 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {allergens.map(a => displayName(a)).join(', ')}
          </p>
        ) : (
          <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            No allergens
          </p>
        )}
      </div>

      {/* Add / Added button */}
      <button
        onClick={() => !isAdded && onAdd(ingredient)}
        disabled={isAdded}
        className={cn(
          'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
          isAdded
            ? 'bg-primary/10 text-primary border border-primary/20 cursor-default'
            : 'bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20'
        )}
      >
        {isAdded ? (
          <><Check className="w-3.5 h-3.5" /> Added</>
        ) : (
          <><Plus className="w-3.5 h-3.5" /> Add</>
        )}
      </button>
    </motion.div>
  )
}

interface PairingsScreenProps {
  suggestions: PairingSuggestion[]
  isLoading: boolean
  onBack: () => void
  onAddIngredient: (ingredient: string) => void
  onGenerateFromPairings: () => void
}

export function PairingsScreen({
  suggestions,
  isLoading,
  onBack,
  onAddIngredient,
  onGenerateFromPairings,
}: PairingsScreenProps) {
  const { preferences } = useFable()
  const totalRestrictions =
    preferences.allergens.length + (preferences.customAllergens?.length ?? 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                Flavour Pairings
              </h1>
              <p className="text-sm text-muted-foreground">
                {totalRestrictions > 0
                  ? `Safe suggestions — ${totalRestrictions} restriction${totalRestrictions > 1 ? 's' : ''} applied`
                  : 'Safe ingredient suggestions based on your kitchen'}
              </p>
            </div>
          </div>

          {/* Tip */}
          {!isLoading && suggestions.length > 0 && (
            <p className="text-xs text-muted-foreground mb-6 ml-14">
              Add ingredients to your kitchen, then generate a recipe from all of them together.
            </p>
          )}

          {/* Loading skeletons */}
          {isLoading ? (
            <div className="space-y-3 mt-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-card border border-border rounded-2xl px-5 py-4 animate-pulse"
                >
                  <div className="w-12 h-12 rounded-full bg-secondary shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-secondary rounded w-1/3" />
                    <div className="h-3 bg-secondary rounded w-1/4" />
                  </div>
                  <div className="w-16 h-7 bg-secondary rounded-full shrink-0" />
                </div>
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <>
              <div className="space-y-3 mt-2">
                {suggestions.map((s, i) => (
                  <PairingCard
                    key={s.ingredient}
                    suggestion={s}
                    index={i}
                    isAdded={preferences.ingredients.includes(s.ingredient)}
                    onAdd={onAddIngredient}
                  />
                ))}
              </div>

              {/* Generate recipe footer */}
              <div className="mt-8 pt-6 border-t border-border">
                <Button
                  size="lg"
                  onClick={onGenerateFromPairings}
                  className="w-full rounded-full gap-2 py-6"
                >
                  <Sparkles className="w-5 h-5" />
                  Generate Recipe from These Pairings
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Claude will craft a recipe using your kitchen ingredients and these pairings
                </p>
              </div>
            </>
          ) : (
            /* Empty */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🔍</span>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No pairings found</h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Try adding more ingredients or adjusting your allergen restrictions.
              </p>
              <Button onClick={onBack} variant="outline" className="rounded-full">Go Back</Button>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}
