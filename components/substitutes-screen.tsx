'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowLeftRight, Loader2, RefreshCw, ChefHat,
  Utensils, X, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth-client'
import { useFable } from '@/lib/fable-context'
import { getEffectiveUseByDate } from '@/lib/shelf-life'
import { normaliseCandidates } from '@/lib/ingredient-utils'
import { cn } from '@/lib/utils'
import allergenMapData from '@/data/allergen-map.json'

const allergenMap = allergenMapData as Record<string, string[]>

// ─── Allergen helpers ─────────────────────────────────────────────────────────

const ALLERGEN_LABELS: Record<string, string> = {
  milk: 'dairy', eggs: 'eggs', gluten: 'gluten', peanuts: 'peanuts',
  tree_nuts: 'tree nuts', fish: 'fish', crustaceans: 'shellfish',
  molluscs: 'molluscs', soy: 'soy', sesame: 'sesame',
  mustard: 'mustard', celery: 'celery', sulphites: 'sulphites', lupin: 'lupin',
}

function getContainedAllergenLabel(epicureKey: string, userAllergens: string[]): string | null {
  const codes = (allergenMap[epicureKey] ?? []).filter((c) => userAllergens.includes(c))
  if (codes.length === 0) return null
  return codes.map((c) => ALLERGEN_LABELS[c] ?? c).join(', ')
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubstituteResult {
  name: string
  displayName: string
  similarityToOriginal: number
  contextFit: number
  combinedScore: number
  explanation: string | null
}

interface EnrichedResult extends SubstituteResult {
  boostedScore: number
  daysUntilExpiry: number | null
  expiryDateDisplay: string | undefined
}

type IngredientStatus = 'in-kitchen' | 'allergen' | 'missing'

interface IngredientAnalysis {
  key: string
  displayName: string
  quantityDisplay: string | undefined
  status: IngredientStatus
  allergenLabel: string | null
  substitute: {
    name: string
    displayName: string
    combinedScore: number
    inKitchen: boolean
  } | null
}

export interface SubstitutesScreenProps {
  onBack: () => void
  initialIngredient?: string
  initialContext?: string[]
  onAdaptAndCook?: (adaptedIngredients: string[], recipeContext?: string) => void
}

type Mode = 'from-kitchen' | 'from-recipe'
type InputMode = 'full-recipe' | 'ingredients-only'

// ─── Normalisation ────────────────────────────────────────────────────────────

function epicureDisplay(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  expiry.setHours(0, 0, 0, 0)
  return Math.floor((expiry.getTime() - today.getTime()) / 86_400_000)
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Returns true if the resolved Epicure key matches any kitchen ingredient (exact or substring). */
function matchesKitchen(key: string, kitchenKeys: string[]): boolean {
  if (kitchenKeys.includes(key)) return true
  return kitchenKeys.some((k) => k.includes(key) || key.includes(k))
}

/** Extract a leading quantity/unit string from a raw ingredient line. */
function extractQuantityDisplay(line: string): string | undefined {
  const m = line.trim().match(
    /^([\d./]+\s*(?:tins?|cans?|jars?|cups?|tbsp|tsp|tablespoons?|teaspoons?|g|kg|ml|l|oz|lbs?|pieces?|handfuls?|pinch|bunch|bunches|large|small|medium)?)\b/i
  )
  const qty = m?.[1]?.trim()
  return qty && qty.length > 0 ? qty : undefined
}

// ─── Async helpers ────────────────────────────────────────────────────────────

async function resolveToEpicureKey(candidate: string): Promise<string | null> {
  const q = candidate.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!q || q.length < 2) return null
  try {
    const res = await fetch(`/api/ingredients?q=${encodeURIComponent(q)}`)
    if (!res.ok) return null
    const data: { results: string[] } = await res.json()
    return data.results[0] ?? null
  } catch {
    return null
  }
}

/** Try multiple normalised candidates until one resolves to an Epicure key. */
async function resolveIngredientKeyRobust(rawName: string): Promise<string | null> {
  for (const candidate of normaliseCandidates(rawName)) {
    const key = await resolveToEpicureKey(candidate)
    if (key) return key
  }
  return null
}

async function extractViaClause(
  text: string,
  userId: string | null
): Promise<{ ingredients: string[]; rateLimitResetAt?: string }> {
  const res = await fetch('/api/extract-ingredients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...(userId ? { userId } : {}) }),
  })
  if (res.status === 429) {
    const data = await res.json().catch(() => ({})) as { resetAt?: string }
    return { ingredients: [], rateLimitResetAt: data.resetAt }
  }
  if (!res.ok) return { ingredients: [] }
  const data: { ingredients: string[] } = await res.json()
  return { ingredients: data.ingredients }
}

/** Parse lines to Epicure keys while preserving the original text for quantity display. */
async function parseIngredientLines(
  lines: string[]
): Promise<{ key: string; original: string }[]> {
  const results = await Promise.all(
    lines.map(async (original) => {
      // Strip leading quantity/measurement before resolving
      const nameOnly = original
        .replace(/^\d[\d./\s]*/, '')
        .replace(
          /\b(cups?|tbsp|tsp|tablespoons?|teaspoons?|g|kg|ml|l|oz|lbs?|tins?|cans?|jars?|pieces?|handfuls?|pinch|bunch|bunches|cloves?|slices?|stalks?)\b/gi,
          ''
        )
        .replace(/\(.*?\)/g, '')
        .trim()
      if (nameOnly.length < 2) return null
      const key = await resolveIngredientKeyRobust(nameOnly)
      return key ? { key, original: original.trim() } : null
    })
  )
  const seen = new Set<string>()
  return results.filter((r): r is { key: string; original: string } => {
    if (!r || seen.has(r.key)) return false
    seen.add(r.key)
    return true
  })
}

async function fetchTopSubstitute(
  ingredient: string,
  context: string[],
  allergens: string[],
  safeIngredients?: string[],
  userId?: string | null,
  adventurousness?: string
): Promise<SubstituteResult | null> {
  try {
    const res = await fetch('/api/substitutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredient,
        context,
        allergens,
        ...(safeIngredients && safeIngredients.length > 0 ? { safeIngredients } : {}),
        ...(userId ? { userId } : {}),
        ...(adventurousness ? { adventurousness } : {}),
      }),
    })
    if (!res.ok) return null
    const data: { substitutes: SubstituteResult[] } = await res.json()
    return data.substitutes[0] ?? null
  } catch {
    return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubstitutesScreen({
  onBack,
  initialIngredient,
  initialContext,
  onAdaptAndCook,
}: SubstitutesScreenProps) {
  const { preferences } = useFable()
  const { data: session } = useSession()
  const isSignedIn = !!session?.user

  const [mode, setMode] = useState<Mode>('from-kitchen')
  const [inputMode, setInputMode] = useState<InputMode>('full-recipe')
  const [fullRecipeText, setFullRecipeText] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [parsedIngredients, setParsedIngredients] = useState<string[]>(() =>
    initialIngredient ? [initialIngredient, ...(initialContext ?? [])].filter(Boolean) : []
  )
  const [parsedOriginalMap, setParsedOriginalMap] = useState<Record<string, string>>({})
  const [isParsing, setIsParsing] = useState(false)

  const [analysis, setAnalysis] = useState<IngredientAnalysis[] | null>(null)
  const [isAnalysing, setIsAnalysing] = useState(false)

  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(
    initialIngredient ?? null
  )
  const [results, setResults] = useState<EnrichedResult[]>([])
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null)

  const kitchenIngredients = preferences.ingredients.map((i) => i.name)

  // ── Recipe analysis ─────────────────────────────────────────────────────────

  const runAnalysis = useCallback(
    async (ingredients: string[], originalMap: Record<string, string>) => {
      if (ingredients.length === 0) return
      setIsAnalysing(true)
      setAnalysis(null)

      const rows: IngredientAnalysis[] = await Promise.all(
        ingredients.map(async (key) => {
          const allergenLabel = getContainedAllergenLabel(key, preferences.allergens)
          const isInKitchen = matchesKitchen(key, kitchenIngredients)
          const quantityDisplay = extractQuantityDisplay(originalMap[key] ?? '')

          if (allergenLabel) {
            const context = ingredients.filter((i) => i !== key)
            const sub = await fetchTopSubstitute(key, context, preferences.allergens, kitchenIngredients, null, preferences.adventurousness)
            // Only accept substitutes that are a reasonable match (≥45 combined score).
            // Below this threshold the swap is too dissimilar to suggest.
            const acceptedSub = sub && sub.combinedScore >= 45 ? sub : null
            return {
              key,
              displayName: epicureDisplay(key),
              quantityDisplay,
              status: 'allergen' as const,
              allergenLabel,
              substitute: acceptedSub
                ? {
                    name: acceptedSub.name,
                    displayName: acceptedSub.displayName,
                    combinedScore: acceptedSub.combinedScore,
                    inKitchen: matchesKitchen(acceptedSub.name, kitchenIngredients),
                  }
                : null,
            }
          }

          if (isInKitchen) {
            return { key, displayName: epicureDisplay(key), quantityDisplay, status: 'in-kitchen' as const, allergenLabel: null, substitute: null }
          }

          return { key, displayName: epicureDisplay(key), quantityDisplay, status: 'missing' as const, allergenLabel: null, substitute: null }
        })
      )

      setAnalysis(rows)
      setIsAnalysing(false)
    },
    [preferences.allergens, kitchenIngredients]
  )

  // ── Kitchen substitute fetch ─────────────────────────────────────────────────

  const fetchSubstitutes = useCallback(
    async (ingredient: string, currentParsed: string[]) => {
      setSelectedIngredient(ingredient)
      setIsLoadingResults(true)
      setResults([])
      setRateLimitMsg(null)

      const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null

      const context =
        initialContext ??
        (mode === 'from-recipe'
          ? currentParsed.filter((i) => i !== ingredient)
          : kitchenIngredients.filter((i) => i !== ingredient))

      try {
        const res = await fetch('/api/substitutes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredient,
            context,
            allergens: preferences.allergens,
            adventurousness: preferences.adventurousness,
            ...(preferences.safeFoodsMode && preferences.safeIngredients.length > 0
              ? { safeIngredients: preferences.safeIngredients }
              : {}),
            ...(uid ? { userId: uid } : {}),
          }),
        })
        if (res.status === 429) {
          const data = await res.json().catch(() => ({})) as { resetAt?: string }
          const time = data.resetAt
            ? new Date(data.resetAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
            : 'soon'
          setRateLimitMsg(`You've used your AI calls for this hour. Resets at ${time}.`)
          return
        }
        if (!res.ok) throw new Error('API error')
        const data: { substitutes: SubstituteResult[] } = await res.json()

        const enriched: EnrichedResult[] = data.substitutes.map((sub) => {
          const kitchenItem =
            mode === 'from-kitchen'
              ? preferences.ingredients.find((i) => i.name === sub.name)
              : undefined
          const effectiveDate = kitchenItem ? getEffectiveUseByDate(kitchenItem) : undefined
          const days = effectiveDate !== undefined ? daysUntil(effectiveDate) : null
          const boostEligible = sub.combinedScore >= 45
          const boost = boostEligible
            ? days !== null && days <= 1 ? 20 : days !== null && days <= 2 ? 10 : 0
            : 0
          return {
            ...sub,
            boostedScore: sub.combinedScore + boost,
            daysUntilExpiry: days,
            expiryDateDisplay: effectiveDate ? formatShortDate(effectiveDate) : undefined,
          }
        })
        enriched.sort((a, b) => b.boostedScore - a.boostedScore)
        setResults(enriched)
      } catch {
        setResults([])
      } finally {
        setIsLoadingResults(false)
      }
    },
    [preferences, initialContext, mode, kitchenIngredients]
  )

  useEffect(() => {
    if (initialIngredient) fetchSubstitutes(initialIngredient, parsedIngredients)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Parse + analyse ──────────────────────────────────────────────────────────

  const currentText = inputMode === 'full-recipe' ? fullRecipeText : ingredientsText
  const setCurrentText = inputMode === 'full-recipe' ? setFullRecipeText : setIngredientsText
  const TEXT_LIMIT = inputMode === 'full-recipe' ? 8000 : 2000
  const isOverLimit = currentText.length > TEXT_LIMIT

  const handleParseRecipe = async () => {
    if (!currentText.trim()) return
    setIsParsing(true)
    setSelectedIngredient(null)
    setResults([])
    setAnalysis(null)
    setRateLimitMsg(null)
    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    try {
      let ingredientNames: string[]
      if (inputMode === 'full-recipe') {
        const extracted = await extractViaClause(fullRecipeText, uid)
        if (extracted.rateLimitResetAt !== undefined) {
          const time = extracted.rateLimitResetAt
            ? new Date(extracted.rateLimitResetAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
            : 'soon'
          setRateLimitMsg(`You've used your AI calls for this hour. Resets at ${time}.`)
          return
        }
        ingredientNames = extracted.ingredients
      } else {
        ingredientNames = ingredientsText.split('\n').filter((l) => l.trim().length > 0)
      }
      const pairs = await parseIngredientLines(ingredientNames)
      const keys = pairs.map((p) => p.key)
      const origMap: Record<string, string> = {}
      for (const p of pairs) origMap[p.key] = p.original
      setParsedIngredients(keys)
      setParsedOriginalMap(origMap)
      await runAnalysis(keys, origMap)
    } finally {
      setIsParsing(false)
    }
  }

  const handleClear = () => {
    setFullRecipeText('')
    setIngredientsText('')
    setParsedIngredients([])
    setParsedOriginalMap({})
    setAnalysis(null)
    setSelectedIngredient(null)
    setResults([])
  }

  const handleSetInputMode = (next: InputMode) => {
    if (next === 'ingredients-only' && inputMode === 'full-recipe') {
      if (parsedIngredients.length > 0 && !ingredientsText.trim()) {
        setIngredientsText(parsedIngredients.map(epicureDisplay).join('\n'))
      }
    }
    setInputMode(next)
  }

  // ── Cook with substitutions ──────────────────────────────────────────────────

  const handleCookWithSubstitutions = () => {
    if (!onAdaptAndCook) return

    const adapted = (analysis
      ? analysis
          .map((item): string | null => {
            if (item.status === 'allergen') return item.substitute ? item.substitute.name : null
            return item.key
          })
          .filter((k): k is string => k !== null)
      : parsedIngredients)

    const recipeContext = (() => {
      const source = fullRecipeText || ingredientsText
      const firstLine = source.split('\n').find((l) => {
        const t = l.trim()
        return t.length > 0 && t.length <= 80 && !/^\d/.test(t)
      })
      return firstLine?.trim() || undefined
    })()

    onAdaptAndCook(adapted, recipeContext)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isOpenedFromRecipe = Boolean(initialIngredient)
  const inKitchenCount = analysis?.filter((r) => r.status === 'in-kitchen').length ?? 0
  const allergenCount  = analysis?.filter((r) => r.status === 'allergen').length ?? 0
  const missingCount   = analysis?.filter((r) => r.status === 'missing').length ?? 0
  const hasUnresolved  = analysis?.some((r) => r.status === 'allergen' && !r.substitute) ?? false

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 rounded-full md:hidden">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-foreground">Substitutes</h1>
              <p className="text-sm text-muted-foreground">Allergen-safe swaps matched to your dish</p>
            </div>
          </div>

          {/* Kitchen / Recipe mode tabs */}
          {!isOpenedFromRecipe && (
            <div className="flex gap-1 mb-6 p-1 bg-secondary rounded-xl">
              {(
                [
                  { id: 'from-kitchen' as const, label: 'From my kitchen', icon: ChefHat },
                  { id: 'from-recipe'  as const, label: 'From a recipe',   icon: Utensils },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setMode(id); setSelectedIngredient(null); setResults([]) }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                    mode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── From a recipe ── */}
          {mode === 'from-recipe' && !isOpenedFromRecipe && (
            <>
              {/* Input panel */}
              <div className="mb-6 space-y-3">
                <div className="flex gap-1 p-1 bg-secondary rounded-lg">
                  {(
                    [
                      { id: 'full-recipe'      as const, label: 'Paste full recipe' },
                      { id: 'ingredients-only' as const, label: 'Ingredients only'  },
                    ] as const
                  ).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => handleSetInputMode(id)}
                      className={cn(
                        'flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors',
                        inputMode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  placeholder={
                    inputMode === 'full-recipe'
                      ? "Paste a full recipe here — title, ingredients, method and all. We'll extract just the ingredients."
                      : 'One ingredient per line, e.g:\n1 pound ground beef\n2 cups salsa\n3 cloves garlic'
                  }
                  className="w-full h-36 text-sm bg-card border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className={cn('text-xs text-right tabular-nums', isOverLimit ? 'text-destructive' : 'text-muted-foreground')}>
                  {currentText.length.toLocaleString('en-US')} / {TEXT_LIMIT.toLocaleString('en-US')}
                </p>

                <div className="flex gap-2">
                  <Button
                    onClick={handleParseRecipe}
                    disabled={!currentText.trim() || isParsing || isOverLimit}
                    className="flex-1 rounded-full gap-2"
                    variant="outline"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {inputMode === 'full-recipe' ? 'Parsing recipe…' : 'Parsing ingredients…'}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        {inputMode === 'full-recipe' ? 'Parse Recipe' : 'Parse Ingredients'}
                      </>
                    )}
                  </Button>
                  {(currentText.trim() || parsedIngredients.length > 0) && (
                    <Button
                      onClick={handleClear}
                      variant="ghost"
                      className="rounded-full gap-1.5 text-muted-foreground hover:text-foreground"
                      disabled={isParsing}
                    >
                      <X className="w-4 h-4" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Rate limit error (extract-ingredients or substitutes) */}
              {!isAnalysing && rateLimitMsg && !analysis && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-4">
                  <p className="text-sm text-muted-foreground">{rateLimitMsg}</p>
                </motion.div>
              )}

              {/* Analysing */}
              {isAnalysing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-10 gap-3">
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Analysing recipe…</p>
                </motion.div>
              )}

              {/* Substitution plan */}
              {!isAnalysing && analysis && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

                  {/* Summary pills */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {inKitchenCount > 0 && (
                      <span className="font-medium text-green-600 dark:text-green-400">
                        ✅ {inKitchenCount} in your kitchen
                      </span>
                    )}
                    {allergenCount > 0 && (
                      <span className="font-medium text-red-600 dark:text-red-400">
                        🔄 {allergenCount} allergen{allergenCount > 1 ? 's' : ''} to swap
                      </span>
                    )}
                    {missingCount > 0 && (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        ⚠️ {missingCount} not in kitchen
                      </span>
                    )}
                  </div>

                  {/* Per-ingredient plan */}
                  <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                    {analysis.map((item) => {
                      const qty = item.quantityDisplay ? ` (${item.quantityDisplay})` : ''

                      if (item.status === 'in-kitchen') {
                        return (
                          <div key={item.key} className="flex items-start gap-3 px-4 py-3 bg-card">
                            <span className="text-base leading-none mt-0.5 shrink-0">✅</span>
                            <p className="text-sm">
                              <span className="font-medium text-foreground">{item.displayName}</span>
                              {qty && <span className="text-muted-foreground">{qty}</span>}
                              <span className="text-muted-foreground"> — in your kitchen</span>
                            </p>
                          </div>
                        )
                      }

                      if (item.status === 'allergen') {
                        if (!item.substitute) {
                          return (
                            <div key={item.key} className="flex items-start gap-3 px-4 py-3 bg-card">
                              <span className="text-base leading-none mt-0.5 shrink-0">❌</span>
                              <p className="text-sm">
                                <span className="font-medium text-foreground">{item.displayName}</span>
                                {qty && <span className="text-muted-foreground">{qty}</span>}
                                <span className="text-muted-foreground"> — contains {item.allergenLabel}, no suitable substitute found — will be omitted</span>
                              </p>
                            </div>
                          )
                        }
                        return (
                          <div key={item.key} className="flex items-start gap-3 px-4 py-3 bg-card">
                            <span className="text-base leading-none mt-0.5 shrink-0">🔄</span>
                            <div className="space-y-0.5">
                              <p className="text-sm">
                                <span className="font-medium text-foreground line-through opacity-60">{item.displayName}</span>
                                {qty && <span className="text-muted-foreground opacity-60">{qty}</span>}
                                <span className="text-xs text-red-600 dark:text-red-400 ml-2 no-underline">contains {item.allergenLabel}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {'→ '}
                                <span className="font-medium text-foreground">{item.substitute.displayName}</span>
                                <span className="text-xs ml-1">({item.substitute.combinedScore}% match)</span>
                                {item.substitute.inKitchen && (
                                  <span className="text-xs text-green-600 dark:text-green-400 ml-1">from your kitchen</span>
                                )}
                                <span className="text-xs ml-1">— being swapped</span>
                              </p>
                            </div>
                          </div>
                        )
                      }

                      // missing
                      return (
                        <div key={item.key} className="flex items-start gap-3 px-4 py-3 bg-card">
                          <span className="text-base leading-none mt-0.5 shrink-0">⚠️</span>
                          <p className="text-sm">
                            <span className="font-medium text-foreground">{item.displayName}</span>
                            {qty && <span className="text-muted-foreground">{qty}</span>}
                            <span className="text-muted-foreground"> — not in kitchen, including anyway</span>
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* CTA */}
                  {onAdaptAndCook && (
                    <div className="space-y-2 pt-1">
                      <Button onClick={handleCookWithSubstitutions} className="w-full rounded-full gap-2 py-6" size="lg">
                        <Sparkles className="w-5 h-5" />
                        Cook with these substitutions
                      </Button>
                      {hasUnresolved && (
                        <p className="text-xs text-center text-muted-foreground">
                          Allergen ingredients with no safe substitute will be omitted from the recipe.
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}

          {/* ── From my kitchen ── */}
          {(mode === 'from-kitchen' || isOpenedFromRecipe) && (
            <>
              {kitchenIngredients.length > 0 && !isOpenedFromRecipe && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-3">
                    {selectedIngredient ? 'Tap another ingredient to swap instead' : 'Tap an ingredient to find substitutes'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence mode="popLayout">
                      {kitchenIngredients.map((ing) => {
                        const isSelected = ing === selectedIngredient
                        return (
                          <motion.button
                            key={ing}
                            layout
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            onClick={() => fetchSubstitutes(ing, [])}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                            )}
                          >
                            {isSelected && <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />}
                            {epicureDisplay(ing)}
                          </motion.button>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {mode === 'from-kitchen' && kitchenIngredients.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center text-center min-h-[calc(100dvh-20rem)]"
                >
                  <div className="text-5xl mb-6">🧑‍🍳</div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">No ingredients yet</h2>
                  <p className="text-muted-foreground max-w-xs mx-auto">
                    Add ingredients to your kitchen first, then come back to find substitutes.
                  </p>
                </motion.div>
              )}

              {isLoadingResults && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-12 gap-4">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Finding the best swaps…</p>
                </motion.div>
              )}

              {!isLoadingResults && results.length > 0 && selectedIngredient && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowLeftRight className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-sm font-medium text-foreground">
                      Substitutes for <span className="text-primary">{epicureDisplay(selectedIngredient)}</span>
                    </p>
                  </div>

                  {results.map((sub, i) => {
                    const goodMatch = sub.combinedScore >= 45
                    const isUrgent  = goodMatch && sub.daysUntilExpiry !== null && sub.daysUntilExpiry <= 1
                    const isSoon    = goodMatch && sub.daysUntilExpiry !== null && sub.daysUntilExpiry === 2
                    return (
                      <motion.div
                        key={sub.name}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="bg-card border border-border rounded-2xl p-4"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-foreground">{sub.displayName}</h3>
                            {isUrgent && (
                              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                                🔴 Use today! — expires {sub.expiryDateDisplay}
                              </p>
                            )}
                            {isSoon && (
                              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                ⚠️ Use soon — expires {sub.expiryDateDisplay}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                            {sub.combinedScore}% match
                          </span>
                        </div>

                        {sub.explanation ? (
                          <p className="text-sm text-muted-foreground leading-relaxed">{sub.explanation}</p>
                        ) : !isSignedIn ? (
                          <p className="text-sm text-muted-foreground italic">Sign in to see why this substitution works.</p>
                        ) : null}

                        <div className="flex gap-6 mt-3 pt-3 border-t border-border/50">
                          <div>
                            <p className="text-xs text-muted-foreground">Similarity</p>
                            <p className="text-sm font-medium text-foreground">{sub.similarityToOriginal}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Context fit</p>
                            <p className="text-sm font-medium text-foreground">{sub.contextFit}%</p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}

              {!isLoadingResults && rateLimitMsg && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="py-6">
                  <p className="text-sm text-muted-foreground">{rateLimitMsg}</p>
                </motion.div>
              )}

              {!isLoadingResults && !rateLimitMsg && selectedIngredient && results.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
                  <p className="text-muted-foreground text-sm">
                    No allergen-safe substitutes found for {epicureDisplay(selectedIngredient)}.
                  </p>
                </motion.div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
