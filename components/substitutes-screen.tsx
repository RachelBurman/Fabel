'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowLeftRight, Loader2, RefreshCw, ChefHat, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFable } from '@/lib/fable-context'
import { cn } from '@/lib/utils'

export interface SubstituteResult {
  name: string
  displayName: string
  similarityToOriginal: number
  contextFit: number
  combinedScore: number
  explanation: string | null
}

export interface SubstitutesScreenProps {
  onBack: () => void
  /** Pre-selected ingredient (Epicure key) — when opened from the recipe screen. */
  initialIngredient?: string
  /** Other recipe ingredient keys to use as context. */
  initialContext?: string[]
}

type Mode = 'from-kitchen' | 'from-recipe'

function epicureDisplay(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Strip quantity + unit tokens from a raw ingredient line, then normalise to an Epicure key. */
function normaliseLine(line: string): string {
  return line
    .replace(/^\d[\d./\s]*/, '')
    .replace(
      /\b(cups?|tbsp|tsp|g|kg|ml|l|oz|lb|pieces?|handfuls?|pinch|bunch|bunches|cloves?|slices?|stalks?)\b/gi,
      ''
    )
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

async function resolveIngredientKey(line: string): Promise<string | null> {
  const key = normaliseLine(line)
  if (!key || key.length < 2) return null
  try {
    const res = await fetch(`/api/ingredients?q=${encodeURIComponent(key.replace(/_/g, ' '))}`)
    if (!res.ok) return null
    const data: { results: string[] } = await res.json()
    return data.results[0] ?? null
  } catch {
    return null
  }
}

async function parseRecipeText(text: string): Promise<string[]> {
  const lines = text
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1)
  const resolved = await Promise.all(lines.map(resolveIngredientKey))
  return [...new Set(resolved.filter((r): r is string => r !== null))]
}

export function SubstitutesScreen({
  onBack,
  initialIngredient,
  initialContext,
}: SubstitutesScreenProps) {
  const { preferences } = useFable()

  const [mode, setMode] = useState<Mode>(
    initialIngredient ? 'from-kitchen' : 'from-kitchen'
  )
  const [recipeText, setRecipeText] = useState('')
  const [parsedIngredients, setParsedIngredients] = useState<string[]>(() =>
    initialIngredient
      ? [initialIngredient, ...(initialContext ?? [])].filter(Boolean)
      : []
  )
  const [isParsing, setIsParsing] = useState(false)

  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(
    initialIngredient ?? null
  )
  const [results, setResults] = useState<SubstituteResult[]>([])
  const [isLoadingResults, setIsLoadingResults] = useState(false)

  const kitchenIngredients = preferences.ingredients.map((i) => i.name)

  const getContext = useCallback(
    (selected: string): string[] => {
      const scope =
        mode === 'from-kitchen'
          ? kitchenIngredients
          : parsedIngredients
      return scope.filter((i) => i !== selected)
    },
    [mode, kitchenIngredients, parsedIngredients]
  )

  const fetchSubstitutes = useCallback(
    async (ingredient: string) => {
      setSelectedIngredient(ingredient)
      setIsLoadingResults(true)
      setResults([])

      const context = initialContext ?? getContext(ingredient)

      try {
        const res = await fetch('/api/substitutes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredient,
            context,
            allergens: preferences.allergens,
            ...(preferences.safeFoodsMode &&
            preferences.safeIngredients.length > 0
              ? { safeIngredients: preferences.safeIngredients }
              : {}),
          }),
        })
        if (!res.ok) throw new Error('API error')
        const data: { substitutes: SubstituteResult[] } = await res.json()
        setResults(data.substitutes)
      } catch {
        setResults([])
      } finally {
        setIsLoadingResults(false)
      }
    },
    [preferences, initialContext, getContext]
  )

  // Auto-fetch when opened with a pre-selected ingredient
  useEffect(() => {
    if (initialIngredient) fetchSubstitutes(initialIngredient)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleParseRecipe = async () => {
    if (!recipeText.trim()) return
    setIsParsing(true)
    try {
      const ingredients = await parseRecipeText(recipeText)
      setParsedIngredients(ingredients)
      setSelectedIngredient(null)
      setResults([])
    } finally {
      setIsParsing(false)
    }
  }

  const activeIngredients =
    mode === 'from-kitchen' ? kitchenIngredients : parsedIngredients

  const isOpenedFromRecipe = Boolean(initialIngredient)

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-foreground">
                Substitutes
              </h1>
              <p className="text-sm text-muted-foreground">
                Allergen-safe swaps matched to your dish
              </p>
            </div>
          </div>

          {/* Mode tabs — hidden when opened from the recipe screen */}
          {!isOpenedFromRecipe && (
            <div className="flex gap-1 mb-6 p-1 bg-secondary rounded-xl">
              {(
                [
                  {
                    id: 'from-kitchen' as const,
                    label: 'From my kitchen',
                    icon: ChefHat,
                  },
                  {
                    id: 'from-recipe' as const,
                    label: 'From a recipe',
                    icon: Utensils,
                  },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setMode(id)
                    setSelectedIngredient(null)
                    setResults([])
                  }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                    mode === id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Mode B — paste a recipe */}
          {mode === 'from-recipe' && !isOpenedFromRecipe && (
            <div className="mb-6 space-y-3">
              <textarea
                value={recipeText}
                onChange={(e) => setRecipeText(e.target.value)}
                placeholder={
                  'Paste a recipe or list ingredients, one per line:\n\n2 cups flour\n1 tbsp butter\n3 eggs\nlemon juice'
                }
                className="w-full h-36 text-sm bg-card border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                onClick={handleParseRecipe}
                disabled={!recipeText.trim() || isParsing}
                className="w-full rounded-full gap-2"
                variant="outline"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Parsing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Parse Ingredients
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Ingredient chips */}
          {activeIngredients.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-3">
                {selectedIngredient
                  ? 'Tap another ingredient to swap instead'
                  : 'Tap an ingredient to find substitutes'}
              </p>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {activeIngredients.map((ing) => {
                    const isSelected = ing === selectedIngredient
                    return (
                      <motion.button
                        key={ing}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        onClick={() => fetchSubstitutes(ing)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                        )}
                      >
                        {isSelected && (
                          <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {epicureDisplay(ing)}
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Empty state — kitchen mode, no ingredients */}
          {mode === 'from-kitchen' &&
            !isOpenedFromRecipe &&
            kitchenIngredients.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                  <ChefHat className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  No ingredients yet
                </h2>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Add ingredients to your kitchen first, then come back to find
                  substitutes.
                </p>
              </motion.div>
            )}

          {/* Empty state — recipe mode, nothing parsed yet */}
          {mode === 'from-recipe' &&
            !isOpenedFromRecipe &&
            parsedIngredients.length === 0 &&
            !isParsing &&
            !recipeText.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-8"
              >
                <p className="text-sm text-muted-foreground">
                  Paste a recipe above and we&apos;ll identify the ingredients
                  for you.
                </p>
              </motion.div>
            )}

          {/* Loading */}
          {isLoadingResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-12 gap-4"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">
                Finding the best swaps…
              </p>
            </motion.div>
          )}

          {/* Results */}
          {!isLoadingResults && results.length > 0 && selectedIngredient && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <ArrowLeftRight className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  Substitutes for{' '}
                  <span className="text-primary">
                    {epicureDisplay(selectedIngredient)}
                  </span>
                </p>
              </div>

              {results.map((sub, i) => (
                <motion.div
                  key={sub.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-card border border-border rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-foreground">
                      {sub.displayName}
                    </h3>
                    <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                      {sub.combinedScore}% match
                    </span>
                  </div>

                  {sub.explanation && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {sub.explanation}
                    </p>
                  )}

                  <div className="flex gap-6 mt-3 pt-3 border-t border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Similarity
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {sub.similarityToOriginal}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Context fit
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {sub.contextFit}%
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* No results */}
          {!isLoadingResults &&
            selectedIngredient &&
            results.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <p className="text-muted-foreground text-sm">
                  No allergen-safe substitutes found for{' '}
                  {epicureDisplay(selectedIngredient)}.
                </p>
              </motion.div>
            )}
        </div>
      </div>
    </div>
  )
}
