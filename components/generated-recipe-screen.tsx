'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { type GeneratedRecipe, type GeneratedRecipeIngredient, type RecipeBrief, type NudgeType } from '@/lib/types'
import { CUISINES } from '@/lib/cuisines'
import { shareRecipe } from '@/lib/share-recipe'
import { ALCOHOL_INGREDIENT_KEYS } from '@/lib/alcohol-ingredients'
import { Clock, Users, ArrowLeft, Loader2, ShieldCheck, Heart, ArrowLeftRight, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RecipeGradient } from '@/components/recipe-gradient'
import { useFable } from '@/lib/fable-context'
import { type SurveyResponse } from '@/lib/survey-signals'
import { useDrinkPairings } from '@/lib/hooks/use-drink-pairings'
import { useRecipeSafeExplain } from '@/lib/hooks/use-recipe-safe-explain'

export type LoadingStep = 'pairings' | 'recipe'

// ─── Equipment detection ────────────────────────────────────────────────────

const EQUIPMENT_RULES: { key: string; label: string; pattern: RegExp }[] = [
  { key: 'hob',         label: 'Hob',            pattern: /\b(hob|stovetop|saucepan|frying pan|boil(s|ed|ing)?)\b/i },
  { key: 'oven',        label: 'Oven',            pattern: /\b(bake[ds]?|baking|roast(s|ed|ing)?|grill(s|ed|ing)?)\b|(?<!pizza )\boven\b/i },
  { key: 'microwave',   label: 'Microwave',       pattern: /\bmicrowave\b/i },
  { key: 'air_fryer',   label: 'Air Fryer',       pattern: /\bair[ -]fr(yer|ied|ies|y(ing|s)?)\b/i },
  { key: 'slow_cooker', label: 'Slow Cooker',     pattern: /\bslow[ -]cook(er|s|ing|ed)?\b/i },
  { key: 'pizza_oven',  label: 'Pizza Oven',      pattern: /\bpizza oven\b/i },
  { key: 'barbecue',    label: 'Barbecue/Grill',  pattern: /\b(barbecue[ds]?|bbq|grill(s|ed|ing)?)\b/i },
]

function detectMissingEquipment(steps: string[], userEquipment: string[]): string[] {
  const has = new Set(userEquipment)
  const allText = steps.join(' ')
  const missing: string[] = []
  for (const rule of EQUIPMENT_RULES) {
    if (!has.has(rule.key) && rule.pattern.test(allText)) {
      missing.push(rule.label)
    }
  }
  return missing
}

interface DrinkPairing {
  drink: string
  score: number
}

interface GeneratedRecipeScreenProps {
  recipe: GeneratedRecipe | null
  recipeId?: string
  loadingStep: LoadingStep | null
  brief?: RecipeBrief | null
  onBack: () => void
  onSave?: () => void
  isSaved?: boolean
  attempted: boolean
  onGoToIngredients?: () => void
  allergens?: string[]
  onFeedback?: (liked: boolean, reasons: string[], notes: string) => void
  onSurveySubmit?: (surveyResponse: SurveyResponse) => void
  showMacros?: boolean
  onFindSubstitute?: (ingredient: string, context: string[]) => void
  lactoseIntolerant?: boolean
  lactoseMode?: 'include' | 'exclude'
  alcoholMode?: 'none' | 'no_cooking' | 'exclude_entirely'
  rateLimitInfo?: { hourRemaining: number; dayRemaining: number; resetAt: string } | null
  macrosRateLimitMsg?: string | null
  guestMode?: boolean
  onOpenAuth?: () => void
  // Nudge props
  isAuthenticated?: boolean
  onNudge?: (type: NudgeType, forcedCuisine?: string) => void
  activeNudge?: NudgeType | null
  isNudging?: boolean
  currentFilters?: { spiceTolerance?: string; dietaryPresets?: string[]; cookTime?: string; cuisine?: string }
}


const RECIPE_POSITIVES = [
  'Perfect complexity',
  'Great cuisine choice',
  'Right amount of ingredients',
  'Quick to make',
]

const RECIPE_NEGATIVES = [
  'Too complex',
  'Too simple',
  'Wrong cuisine vibe',
  'Too many ingredients',
  'Took too long',
]

// Countable items that must always be displayed as whole numbers
const WHOLE_UNITS = new Set([
  'piece', 'pieces', 'clove', 'cloves', 'fillet', 'fillets',
  'leaf', 'leaves', 'sprig', 'sprigs', 'stalk', 'stalks',
  'floret', 'florets', 'strip', 'strips', 'slice', 'slices',
  'wedge', 'wedges', 'ring', 'rings', 'chunk', 'chunks',
  'rasher', 'rashers', 'sheet', 'sheets',
])

function formatAmount(amount: GeneratedRecipeIngredient['amount'], unit: string): string {
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount))
  if (isNaN(n)) return String(amount)
  if (WHOLE_UNITS.has(unit.toLowerCase().trim())) return String(Math.round(n))
  return String(Math.round(n * 10) / 10)
}

function parseAmount(amount: GeneratedRecipeIngredient['amount']): number {
  if (typeof amount === 'number') return amount
  const n = parseFloat(String(amount))
  return isNaN(n) ? 0 : n
}

function formatDrinkName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getDrinkEmoji(key: string): string {
  if (key.includes('tea'))                                               return '🍵'
  if (key === 'coffee')                                                  return '☕'
  if (key.includes('milk') || key === 'buttermilk')                     return '🥛'
  if (key.includes('beer') || key.includes('cider') || key === 'ginger_ale') return '🍺'
  if (key.includes('wine') || key === 'champagne' || key === 'sake')    return '🍷'
  if (key.includes('juice'))                                             return '🧃'
  if (['whiskey', 'rum', 'gin', 'vodka'].includes(key) || key.includes('liqueur')) return '🍸'
  return '🥤'
}

// ─── Recipe Brief Card ────────────────────────────────────────────────────────

const NUDGE_BUTTONS: {
  type: NudgeType
  emoji: string
  label: string
  hiddenWhen: (p: { spiceTolerance?: string; dietaryPresets?: string[]; cookTime?: string }) => boolean
}[] = [
  { type: 'spicier',    emoji: '🌶️', label: 'Make it spicier',   hiddenWhen: p => p.spiceTolerance === 'hot' },
  { type: 'vegetarian', emoji: '🥗', label: 'Make it vegetarian', hiddenWhen: p => !!(p.dietaryPresets?.includes('vegetarian') || p.dietaryPresets?.includes('vegan')) },
  { type: 'quicker',    emoji: '⚡', label: 'Make it quicker',    hiddenWhen: p => p.cookTime === 'quick' },
  { type: 'cuisine',    emoji: '🌍', label: 'Different cuisine',  hiddenWhen: () => false },
  { type: 'surprise',   emoji: '🔄', label: 'Surprise me',        hiddenWhen: () => false },
]

interface RecipeBriefCardProps {
  brief: RecipeBrief
  isAuthenticated?: boolean
  onNudge?: (type: NudgeType) => void
  onNudgeCuisine?: () => void
  activeNudge?: NudgeType | null
  isNudging?: boolean
  spiceTolerance?: string
  dietaryPresets?: string[]
  cookTime?: string
}

function RecipeBriefCard({
  brief,
  isAuthenticated = false,
  onNudge,
  onNudgeCuisine,
  activeNudge,
  isNudging = false,
  spiceTolerance,
  dietaryPresets,
  cookTime,
}: RecipeBriefCardProps) {
  const fallbackHints = [
    "Safe ingredients. Bold flavours. Food for everyone.",
    "Fable uses Epicure — the largest multilingual food embedding model ever built.",
    "The more you cook with Fable, the better it knows your taste.",
  ]
  // Keep hints in a ref so the rotation timer never resets when the brief updates
  const hintsRef = useRef(brief.loadingHints.length > 0 ? brief.loadingHints : fallbackHints)
  hintsRef.current = brief.loadingHints.length > 0 ? brief.loadingHints : fallbackHints

  const [hintIndex, setHintIndex] = useState(0)
  const currentHint = hintsRef.current[hintIndex % hintsRef.current.length] ?? hintsRef.current[0]

  // Timer starts once on mount and never resets — hints rotate continuously
  useEffect(() => {
    const id = setInterval(() => {
      setHintIndex(i => (i + 1) % hintsRef.current.length)
    }, 3000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleNudges = isAuthenticated && onNudge
    ? NUDGE_BUTTONS.filter(b => !b.hiddenWhen({ spiceTolerance, dietaryPresets, cookTime }))
    : []

  const handleNudgeClick = (type: NudgeType) => {
    if (type === 'cuisine') {
      onNudgeCuisine?.()
    } else {
      onNudge?.(type)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden border border-border shadow-sm"
    >
      {/* Gradient header */}
      <div
        className="relative px-5 py-4"
        style={{ background: 'linear-gradient(135deg, #78350f 0%, #c2410c 45%, #9f1239 100%)' }}
      >
        <div className="absolute top-0 right-0 w-36 h-36 rounded-full opacity-30" style={{ background: 'rgba(251,191,36,0.32)', filter: 'blur(40px)', transform: 'translate(24px,-24px)' }} />
        <p className="relative text-white/70 text-xs font-medium uppercase tracking-widest mb-1">
          I&apos;m thinking…
        </p>
        {brief.direction ? (
          <motion.p
            animate={{ opacity: isNudging ? 0.6 : 1 }}
            transition={{ duration: 0.3 }}
            className="relative text-white text-base font-semibold leading-snug drop-shadow"
          >
            {brief.direction}
          </motion.p>
        ) : (
          <Loader2 className="relative w-5 h-5 text-white/60 animate-spin mt-1" />
        )}
      </div>

      {/* Body */}
      <div className="bg-card px-5 py-4 space-y-4">
        {brief.direction && (
          <>
            <motion.div
              animate={{ opacity: isNudging ? 0.6 : 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-1.5"
            >
              {brief.reasoning && (
                <p className="text-sm text-foreground leading-relaxed">{brief.reasoning}</p>
              )}
              {brief.noveltyNote && (
                <p className="text-xs text-muted-foreground">··· {brief.noveltyNote}</p>
              )}
            </motion.div>
            <div className="border-t border-border" />
          </>
        )}

        {/* Rotating hint — timer never resets during nudge */}
        <AnimatePresence mode="wait">
          <motion.p
            key={hintIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-muted-foreground leading-relaxed"
          >
            <span className="mr-1.5">💡</span>{currentHint}
          </motion.p>
        </AnimatePresence>

        {/* Nudge buttons — authenticated users only, shown when brief has direction */}
        {visibleNudges.length > 0 && brief.direction && (
          <div className="flex flex-wrap gap-2">
            {visibleNudges.map(btn => (
              <button
                key={btn.type}
                onClick={() => handleNudgeClick(btn.type)}
                disabled={isNudging && activeNudge !== btn.type}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all duration-200',
                  activeNudge === btn.type
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-secondary text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary',
                  isNudging && activeNudge !== btn.type ? 'opacity-40 pointer-events-none' : '',
                )}
              >
                <span>{btn.emoji}</span>
                <span>{btn.label}</span>
                {activeNudge === btn.type && <span className="ml-0.5">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function GeneratedRecipeScreen({
  recipe,
  recipeId,
  loadingStep,
  brief,
  onBack,
  onSave,
  isSaved,
  attempted,
  onGoToIngredients,
  allergens = [],
  onFeedback,
  onSurveySubmit,
  showMacros = false,
  onFindSubstitute,
  lactoseIntolerant = false,
  lactoseMode,
  alcoholMode = 'none',
  rateLimitInfo,
  macrosRateLimitMsg,
  guestMode = false,
  onOpenAuth,
  isAuthenticated = false,
  onNudge,
  activeNudge,
  isNudging = false,
  currentFilters,
}: GeneratedRecipeScreenProps) {
  const { preferences } = useFable()
  const isLoading = loadingStep !== null

  const [cuisinePickerOpen, setCuisinePickerOpen] = useState(false)
  const missingEquipment = recipe ? detectMissingEquipment(recipe.steps, preferences.kitchenEquipment) : []

  const drinkPairingsMutation = useDrinkPairings()
  const safeExplainMutation = useRecipeSafeExplain()

  const [drinkPairings, setDrinkPairings] = useState<DrinkPairing[]>([])
  const [sharing, setSharing] = useState(false)

  const [safeExplainText, setSafeExplainText] = useState<string | null>(null)
  const [safeExplainOpen, setSafeExplainOpen] = useState(false)

  const [feedbackGiven, setFeedbackGiven] = useState<'liked' | 'disliked' | null>(null)
  const [showSurveyPanel, setShowSurveyPanel] = useState(false)
  const [highlightedIngredients, setHighlightedIngredients] = useState<string[]>([])
  const [skippedIngredients, setSkippedIngredients] = useState<string[]>([])
  const [recipePositives, setRecipePositives] = useState<string[]>([])
  const [recipeNegatives, setRecipeNegatives] = useState<string[]>([])

  useEffect(() => {
    setFeedbackGiven(null)
    setShowSurveyPanel(false)
    setHighlightedIngredients([])
    setSkippedIngredients([])
    setRecipePositives([])
    setRecipeNegatives([])
    setSafeExplainText(null)
    setSafeExplainOpen(false)

    if (!recipe) {
      setDrinkPairings([])
      return
    }

    const top3 = [...recipe.ingredients]
      .sort((a, b) => parseAmount(b.amount) - parseAmount(a.amount))
      .slice(0, 3)
      .map(i => i.name)

    setDrinkPairings([])
    drinkPairingsMutation
      .mutateAsync({ ingredients: top3, allergens, ...(alcoholMode !== 'none' ? { alcoholMode } : {}) })
      .then(data => setDrinkPairings(data.pairings ?? []))
      .catch(() => {})
  }, [recipe]) // eslint-disable-line react-hooks/exhaustive-deps

  const drinkPairingsLoading = drinkPairingsMutation.isPending

  const handleSafeExplain = async () => {
    if (guestMode) {
      onOpenAuth?.()
      return
    }
    if (safeExplainText !== null) {
      setSafeExplainOpen(prev => !prev)
      return
    }
    if (safeExplainMutation.isPending || !recipe) return
    try {
      const lactoseModeBody =
        lactoseIntolerant && lactoseMode === 'include' ? 'reminder' :
        lactoseIntolerant && lactoseMode === 'exclude' ? 'exclude' :
        undefined
      const data = await safeExplainMutation.mutateAsync({
        recipeTitle: recipe.title,
        ingredients: recipe.ingredients.map(i => i.name),
        allergens,
        dietPresets: preferences.activePresets,
        safeFoodsMode: preferences.safeFoodsMode,
        safeFoods: preferences.safeFoodsMode ? preferences.safeIngredients : undefined,
        lactoseMode: lactoseModeBody,
      })
      setSafeExplainText(data.explanation)
      setSafeExplainOpen(true)
    } catch {
      // silently fail
    }
  }

  const handleShare = async () => {
    if (!recipe || !recipeId || sharing) return
    setSharing(true)
    try {
      await shareRecipe(recipeId, recipe)
    } finally {
      setSharing(false)
    }
  }

  const handleLike = () => {
    setFeedbackGiven('liked')
    onFeedback?.(true, [], '')
    setShowSurveyPanel(true)
  }

  const handleDislike = () => {
    setFeedbackGiven('disliked')
    onFeedback?.(false, [], '')
    setShowSurveyPanel(true)
  }

  const toggleHighlighted = (name: string) => {
    setHighlightedIngredients(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    )
    setSkippedIngredients(prev => prev.filter(i => i !== name))
  }

  const toggleSkipped = (name: string) => {
    setSkippedIngredients(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    )
    setHighlightedIngredients(prev => prev.filter(i => i !== name))
  }

  const toggleRecipePositive = (chip: string) => {
    setRecipePositives(prev =>
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    )
  }

  const toggleRecipeNegative = (chip: string) => {
    setRecipeNegatives(prev =>
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    )
  }

  const handleSurveySkip = () => setShowSurveyPanel(false)

  const handleSurveyDone = () => {
    const hasSelections =
      highlightedIngredients.length > 0 ||
      skippedIngredients.length > 0 ||
      recipePositives.length > 0 ||
      recipeNegatives.length > 0

    if (hasSelections) {
      onSurveySubmit?.({
        ingredientsHighlighted: highlightedIngredients,
        ingredientsSkipped: skippedIngredients,
        recipePositives,
        recipeNegatives,
      })
    }
    setShowSurveyPanel(false)
  }

  // Full-page empty state — nothing generated yet
  if (!isLoading && !recipe && !attempted) {
    return (
      <div className="bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] px-6 text-center"
        >
          <div className="text-5xl mb-6">🍽️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No recipe yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto mb-8">
            Head to Ingredients to build your kitchen and generate your first recipe.
          </p>
          <Button onClick={onGoToIngredients} className="rounded-full">
            Go to Ingredients
          </Button>
        </motion.div>
      </div>
    )
  }

  // Full-page error state — generation was attempted but failed
  if (!isLoading && !recipe && attempted) {
    if (guestMode) {
      return (
        <div className="bg-background">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] px-6 text-center"
          >
            <div className="text-5xl mb-6">🥘</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No matching recipes found</h2>
            <p className="text-muted-foreground max-w-sm mx-auto mb-8">
              We couldn&apos;t find a community recipe that matches your requirements. Sign in to generate a personalised recipe with AI.
            </p>
            <Button onClick={onOpenAuth} className="rounded-full mb-3">Sign in to Fable</Button>
            <Button onClick={onBack} variant="outline" className="rounded-full">Go Back</Button>
          </motion.div>
        </div>
      )
    }
    return (
      <div className="bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] px-6 text-center"
        >
          <div className="text-5xl mb-6">🍳</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Couldn&apos;t generate a recipe</h2>
          <p className="text-muted-foreground max-w-sm mx-auto mb-8">
            Something went wrong. Try again or adjust your ingredients.
          </p>
          <Button onClick={onBack} variant="outline" className="rounded-full">
            Go Back
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      {/* Cuisine picker bottom sheet — opens when user taps "Different cuisine" nudge */}
      <AnimatePresence>
        {cuisinePickerOpen && (
          <>
            <motion.div
              key="cuisine-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setCuisinePickerOpen(false)}
            />
            <motion.div
              key="cuisine-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl px-6 pt-6 pb-10 max-h-[70vh] overflow-y-auto"
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
              <h3 className="text-base font-semibold text-foreground mb-4">Choose a cuisine</h3>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setCuisinePickerOpen(false)
                      onNudge?.('cuisine', value)
                    }}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-full transition-colors',
                      currentFilters?.cuisine === value
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">

          {/* Back + title (during load) + save */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              disabled={isLoading}
              className="back-btn shrink-0 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {/* Show title while loading (recipe title lives in the gradient hero) */}
            {isLoading && (
              <h1 className="flex-1 text-xl md:text-2xl font-semibold text-foreground">
                Generating Recipe…
              </h1>
            )}

            {recipe && <div className="flex-1" />}

            {!isLoading && recipe && (
              <button
                onClick={handleSafeExplain}
                disabled={safeExplainMutation.isPending}
                className={cn(
                  'shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-card border transition-all duration-200 disabled:opacity-50',
                  guestMode
                    ? 'border-border text-muted-foreground/50 cursor-pointer'
                    : 'border-border text-primary hover:border-primary/50'
                )}
                aria-label={guestMode ? 'Sign in to see why this recipe is safe for you' : 'Why is this safe for me?'}
                title={guestMode ? 'Sign in to see why this recipe is safe for you' : 'Why is this safe for me?'}
              >
                {safeExplainMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ShieldCheck className="w-4 h-4" />}
              </button>
            )}

            {!isLoading && recipe && recipeId && (
              <button
                onClick={handleShare}
                disabled={sharing}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-200 disabled:opacity-50"
                aria-label="Share recipe"
              >
                {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              </button>
            )}

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
            loadingStep === 'recipe' && brief ? (
              <RecipeBriefCard
                brief={brief}
                isAuthenticated={isAuthenticated}
                onNudge={onNudge ? (type) => onNudge(type) : undefined}
                onNudgeCuisine={onNudge ? () => setCuisinePickerOpen(true) : undefined}
                activeNudge={activeNudge}
                isNudging={isNudging}
                spiceTolerance={currentFilters?.spiceTolerance}
                dietaryPresets={currentFilters?.dietaryPresets}
                cookTime={currentFilters?.cookTime}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-16"
              >
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </motion.div>
            )
          )}

          {/* Recipe */}
          {!isLoading && recipe && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Hero gradient */}
              <RecipeGradient title={recipe.title} className="w-full h-52 rounded-2xl">
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <p className="text-white/60 text-xs font-medium uppercase tracking-widest mb-1.5">
                    Recipe
                  </p>
                  <h2 className="text-white text-xl md:text-2xl font-bold leading-snug text-balance drop-shadow">
                    {recipe.title}
                  </h2>
                </div>
              </RecipeGradient>

              <p className="text-muted-foreground leading-relaxed text-pretty">
                {recipe.description}
              </p>

              {/* Safety explainer card */}
              <AnimatePresence>
                {safeExplainOpen && safeExplainText && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-semibold text-foreground">Why this is safe for you 🛡️</p>
                        <button
                          onClick={() => setSafeExplainOpen(false)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{safeExplainText}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {guestMode && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-base shrink-0">🍳</span>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    You&apos;re seeing a community recipe —{' '}
                    <button
                      onClick={onOpenAuth}
                      className="font-medium underline underline-offset-2 hover:no-underline"
                    >
                      Sign in
                    </button>
                    {' '}to generate a personalised recipe with AI.
                  </p>
                </div>
              )}

              {!guestMode && rateLimitInfo && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-base shrink-0">🍳</span>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <span className="font-medium">You&apos;ve reached your recipe limit for now</span>
                    {' '}— here&apos;s a community recipe that matches your preferences.{' '}
                    Resets at {new Date(rateLimitInfo.resetAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.
                  </p>
                </div>
              )}

              {missingEquipment.length > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-base shrink-0">⚠️</span>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Some steps may require equipment you haven&apos;t selected:</span>
                    {' '}{missingEquipment.join(', ')}.{' '}
                    You may need to adapt these steps.
                  </p>
                </div>
              )}

              {lactoseIntolerant && lactoseMode === 'include' && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-base shrink-0">🥛</span>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Contains dairy</span> — consider taking Lactaid before eating.
                  </p>
                </div>
              )}

              {alcoholMode === 'no_cooking' && recipe.ingredients.some(ing =>
                ALCOHOL_INGREDIENT_KEYS.includes(ing.name.toLowerCase().replace(/\s+/g, '_'))
              ) && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-base shrink-0">⚠️</span>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <span className="font-medium">This recipe may contain alcohol</span> — check ingredients before cooking.
                  </p>
                </div>
              )}

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

              {/* Macros */}
              {showMacros && macrosRateLimitMsg && !recipe.macros && (
                <p className="text-sm text-muted-foreground">{macrosRateLimitMsg}</p>
              )}
              {showMacros && recipe.macros && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Estimated nutritional information</p>
                  <div className="grid grid-cols-4 gap-3 py-4 border border-border rounded-2xl px-4 text-center">
                    {[
                      { label: 'Calories', value: String(recipe.macros.calories), unit: 'kcal' },
                      { label: 'Protein',  value: String(recipe.macros.protein),  unit: 'g' },
                      { label: 'Carbs',    value: String(recipe.macros.carbs),    unit: 'g' },
                      { label: 'Fat',      value: String(recipe.macros.fat),      unit: 'g' },
                    ].map(({ label, value, unit }) => (
                      <div key={label}>
                        <p className="text-base font-semibold text-foreground">{value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span></p>
                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Estimates based on ingredients and quantities — consult a nutritionist for precise values.</p>
                </div>
              )}

              {/* Feedback row */}
              <div className="flex items-center justify-between -mt-4">
                {feedbackGiven === null && (
                  <>
                    <span className="text-sm text-muted-foreground">Rate this recipe</span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleLike}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-secondary hover:bg-primary/10 transition-colors text-base"
                        aria-label="Like"
                      >
                        👍
                      </button>
                      <button
                        onClick={handleDislike}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-secondary hover:bg-destructive/10 transition-colors text-base"
                        aria-label="Dislike"
                      >
                        👎
                      </button>
                    </div>
                  </>
                )}
                {feedbackGiven === 'liked' && (
                  <span className="text-sm text-primary font-medium">👍 Thanks for the feedback!</span>
                )}
                {feedbackGiven === 'disliked' && (
                  <span className="text-sm text-muted-foreground font-medium">👎 Thanks, we&apos;ll do better next time.</span>
                )}
              </div>

              {/* Survey panel — appears after thumbs up or down */}
              <AnimatePresence>
                {showSurveyPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden -mt-4"
                  >
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Tell us more (optional)</p>
                        <button
                          onClick={handleSurveySkip}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Skip
                        </button>
                      </div>

                      {/* Section 1: Highlight */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">✨ Highlight of the dish</p>
                        <div className="flex flex-wrap gap-2">
                          {recipe?.ingredients.map(ing => (
                            <button
                              key={ing.name}
                              onClick={() => toggleHighlighted(ing.name)}
                              className={cn(
                                'px-3 py-1.5 rounded-full text-sm transition-colors',
                                highlightedIngredients.includes(ing.name)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary'
                              )}
                            >
                              {ing.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section 2: Would leave out */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">🚫 Would leave out</p>
                        <div className="flex flex-wrap gap-2">
                          {recipe?.ingredients.map(ing => (
                            <button
                              key={ing.name}
                              onClick={() => toggleSkipped(ing.name)}
                              className={cn(
                                'px-3 py-1.5 rounded-full text-sm transition-colors',
                                skippedIngredients.includes(ing.name)
                                  ? 'bg-destructive/20 text-destructive'
                                  : 'bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                              )}
                            >
                              {ing.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section 3: What worked */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">👌 What worked</p>
                        <div className="flex flex-wrap gap-2">
                          {RECIPE_POSITIVES.map(chip => (
                            <button
                              key={chip}
                              onClick={() => toggleRecipePositive(chip)}
                              className={cn(
                                'px-3 py-1.5 rounded-full text-sm transition-colors',
                                recipePositives.includes(chip)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary'
                              )}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section 4: What didn't */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">😬 What didn&apos;t</p>
                        <div className="flex flex-wrap gap-2">
                          {RECIPE_NEGATIVES.map(chip => (
                            <button
                              key={chip}
                              onClick={() => toggleRecipeNegative(chip)}
                              className={cn(
                                'px-3 py-1.5 rounded-full text-sm transition-colors',
                                recipeNegatives.includes(chip)
                                  ? 'bg-destructive/20 text-destructive'
                                  : 'bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                              )}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleSurveyDone}
                        className="rounded-full w-full"
                        size="sm"
                      >
                        Done
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ingredients */}
              <section>
                <h2 className="text-lg font-semibold text-foreground mb-4">Ingredients</h2>
                <ul className="space-y-2.5">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="flex-1 text-foreground">
                        <span className="font-medium">{formatAmount(ing.amount, ing.unit)} {ing.unit}</span>
                        {' '}{ing.name}
                      </span>
                      {onFindSubstitute && (
                        <button
                          onClick={() => {
                            const key = ing.name.toLowerCase().replace(/\s+/g, '_')
                            const context = recipe.ingredients
                              .filter((_, j) => j !== i)
                              .map((r) => r.name.toLowerCase().replace(/\s+/g, '_'))
                            onFindSubstitute(key, context)
                          }}
                          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          aria-label={`Find substitutes for ${ing.name}`}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Steps */}
              <section>
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

              {/* Drink Pairings */}
              <section className="pb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Drink Pairings</h2>
                {drinkPairingsLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Finding drink pairings…</span>
                  </div>
                )}
                {!drinkPairingsLoading && drinkPairings.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {drinkPairings.map(({ drink }) => (
                      <span
                        key={drink}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
                      >
                        {getDrinkEmoji(drink)} {formatDrinkName(drink)}
                      </span>
                    ))}
                  </div>
                )}
                {!drinkPairingsLoading && drinkPairings.length === 0 && (
                  <p className="text-sm text-muted-foreground">No drink suggestions found.</p>
                )}
              </section>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}
