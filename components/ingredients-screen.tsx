'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFable } from '@/lib/fable-context'
import { type IngredientArea, type IngredientUnit, INGREDIENT_UNITS } from '@/lib/types'
import { getShelfLifeDays, addDays, getEffectiveUseByDate } from '@/lib/shelf-life'
import { Plus, X, Search, ChefHat, Sparkles, Layers, Check, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import allergenMapData from '@/data/allergen-map.json'

const allergenMap = allergenMapData as Record<string, string[]>

function hasUserAllergen(ingredient: string, userAllergens: string[], customAllergens: string[]): boolean {
  if (customAllergens.includes(ingredient)) return true
  return (allergenMap[ingredient] ?? []).some(code => userAllergens.includes(code))
}

// ─── Filter types ─────────────────────────────────────────────────────────────

export type MealType = 'snack' | 'starter' | 'main' | 'dessert'
export type CookTime = 'quick' | 'medium' | 'slow'

export interface RecipeFilters {
  mealType: MealType
  cookTime: CookTime
  kitchenOnly: boolean
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'snack',   label: 'Snack' },
  { value: 'starter', label: 'Starter' },
  { value: 'main',    label: 'Main Course' },
  { value: 'dessert', label: 'Dessert' },
]

const COOK_TIMES: { value: CookTime; label: string }[] = [
  { value: 'quick',  label: 'Quick (<30m)' },
  { value: 'medium', label: 'Medium (30–60m)' },
  { value: 'slow',   label: 'Slow Cook (60m+)' },
]

// ─── Area + unit config ───────────────────────────────────────────────────────

const AREAS: { value: IngredientArea; emoji: string; label: string }[] = [
  { value: 'fridge',   emoji: '🧊', label: 'Fridge' },
  { value: 'freezer',  emoji: '❄️', label: 'Freezer' },
  { value: 'cupboard', emoji: '🗄️', label: 'Cupboard' },
  { value: 'pantry',   emoji: '🏠', label: 'Pantry' },
]

function areaConfig(area: IngredientArea) {
  return AREAS.find(a => a.value === area) ?? AREAS[0]
}

const POPULAR_POOL = [
  'chicken', 'garlic', 'onion', 'tomato', 'lemon',
  'olive_oil', 'ginger', 'rice', 'egg', 'butter',
  'salmon', 'pasta', 'potato', 'carrot', 'spinach',
  'broccoli', 'mushroom', 'apple', 'banana', 'oats',
  'chickpea', 'lentil', 'tofu', 'beef', 'pork',
  'zucchini', 'pepper', 'cucumber', 'avocado', 'coconut_oil',
  'honey', 'maple_syrup', 'quinoa', 'kale', 'sweet_potato',
]

const QUICK_ADD_COUNT = 12

export function displayName(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function getDaysUntilExpiry(effectiveDate?: string): number | null {
  if (!effectiveDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(effectiveDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// ─── Header ───────────────────────────────────────────────────────────────────

function IngredientsHeader({ safeFoodsActive }: { safeFoodsActive: boolean }) {
  return (
    <div className="text-center mb-8">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
        style={safeFoodsActive
          ? { backgroundColor: 'rgba(34,197,94,0.12)' }
          : { backgroundColor: 'var(--primary-10, oklch(0.55 0.12 145 / 0.1))' }}
      >
        <ChefHat
          className="w-8 h-8"
          style={safeFoodsActive ? { color: '#16a34a' } : { color: 'var(--primary)' }}
        />
      </div>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2 text-balance">
        {safeFoodsActive ? 'Which safe ingredients do you have today?' : "What's in your kitchen?"}
      </h1>
      <p className="text-muted-foreground text-pretty">
        {safeFoodsActive
          ? 'Pick from your safe list — recipes will use only these ingredients'
          : "Add the ingredients you have and we'll find matching recipes"}
      </p>
    </div>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface IngredientsScreenProps {
  onShowPairings: (filters: RecipeFilters) => void
  onGenerateRecipe: (filters: RecipeFilters) => void
}

export function IngredientsScreen({ onShowPairings, onGenerateRecipe }: IngredientsScreenProps) {
  const { preferences, addIngredient, removeIngredient } = useFable()
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<string[]>([])

  // Staging state
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [pendingArea, setPendingArea] = useState<IngredientArea>('fridge')
  const [pendingSubtype, setPendingSubtype] = useState('')
  const [pendingQuantity, setPendingQuantity] = useState('1')
  const [pendingUnit, setPendingUnit] = useState<IngredientUnit>('pieces')
  const [pendingDateType, setPendingDateType] = useState<'use-by' | 'bought'>('use-by')
  const [pendingDate, setPendingDate] = useState('')      // use-by date
  const [pendingBoughtDate, setPendingBoughtDate] = useState('') // bought date

  // Filter state
  const [mealType, setMealType] = useState<MealType>('main')
  const [cookTime, setCookTime] = useState<CookTime>('medium')
  const [kitchenOnly, setKitchenOnly] = useState(false)

  // Portal dropdown positioning
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const recomputeCoords = useCallback(() => {
    if (inputWrapperRef.current) {
      const r = inputWrapperRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 8, left: r.left, width: r.width })
    }
  }, [])

  useEffect(() => {
    const q = inputValue.trim()
    if (!q) { setSearchResults([]); return }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ingredients?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data: { results: string[] } = await res.json()
          setSearchResults(data.results)
          recomputeCoords()
        }
      } catch { /* silently ignore */ }
    }, 150)
    return () => clearTimeout(id)
  }, [inputValue, recomputeCoords])

  useEffect(() => {
    if (showDropdown) recomputeCoords()
  }, [showDropdown, recomputeCoords])

  const resetStaging = useCallback(() => {
    setPendingName(null)
    setPendingArea('fridge')
    setPendingSubtype('')
    setPendingQuantity('1')
    setPendingUnit('pieces')
    setPendingDateType('use-by')
    setPendingDate('')
    setPendingBoughtDate('')
  }, [])

  const handleSelectFromSearch = useCallback((name: string) => {
    setPendingName(name)
    setPendingArea('fridge')
    setPendingSubtype('')
    setPendingQuantity('1')
    setPendingUnit('pieces')
    setPendingDateType('use-by')
    setPendingDate('')
    setPendingBoughtDate('')
    setInputValue('')
    setSearchResults([])
    setShowDropdown(false)
  }, [])

  const handleConfirmAdd = useCallback(() => {
    if (!pendingName) return
    const sub = pendingSubtype.trim()
    const label = sub
      ? `${displayName(pendingName)} ${sub.charAt(0).toUpperCase()}${sub.slice(1)}`
      : undefined

    addIngredient(pendingName, {
      area: pendingArea,
      displayName: label,
      subtype: sub || undefined,
      quantity: pendingQuantity !== '1' || pendingUnit !== 'pieces' ? pendingQuantity : undefined,
      unit: pendingUnit,
      dateType: pendingDate || pendingBoughtDate ? pendingDateType : undefined,
      useByDate: pendingDateType === 'use-by' ? (pendingDate || undefined) : undefined,
      boughtDate: pendingDateType === 'bought' ? (pendingBoughtDate || undefined) : undefined,
    })
    resetStaging()
  }, [pendingName, pendingArea, pendingSubtype, pendingQuantity, pendingUnit, pendingDateType, pendingDate, pendingBoughtDate, addIngredient, resetStaging])

  const handleQuickAdd = useCallback((name: string) => {
    addIngredient(name, { area: 'fridge' })
  }, [addIngredient])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleSelectFromSearch(dropdownItems[0] ?? inputValue.trim().toLowerCase().replace(/\s+/g, '_'))
    }
    if (e.key === 'Escape') setShowDropdown(false)
  }

  // Calculated expected expiry preview for the "bought date" mode
  const expectedExpiry = pendingName && pendingBoughtDate
    ? addDays(pendingBoughtDate, getShelfLifeDays(pendingName))
    : null

  const dropdownItems = searchResults.filter(r => !preferences.ingredients.some(i => i.name === r))
  const addedNames = new Set(preferences.ingredients.map(i => i.name))
  const filters: RecipeFilters = { mealType, cookTime, kitchenOnly }

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

          <IngredientsHeader safeFoodsActive={preferences.safeFoodsMode && preferences.safeIngredients.length > 0} />

          {/* Search */}
          <div className="relative mb-4">
            <div ref={inputWrapperRef} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search 1,790 ingredients…"
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); setShowDropdown(e.target.value.length > 0) }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => { if (inputValue.length > 0) setShowDropdown(true); recomputeCoords() }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="pl-12 pr-4 py-6 text-base rounded-xl bg-card border-border"
              />
            </div>
          </div>

          {/* ── Staging panel ── */}
          <AnimatePresence>
            {pendingName && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-4 overflow-hidden"
              >
                <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-4">

                  {/* Title row */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{displayName(pendingName)}</span>
                    <button onClick={resetStaging} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Subtype */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Specify type <span className="opacity-60">(optional)</span></p>
                    <input
                      type="text"
                      placeholder="e.g. breast, thighs, ribeye, baby"
                      value={pendingSubtype}
                      onChange={e => setPendingSubtype(e.target.value)}
                      className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Helps generate more accurate recipes</p>
                  </div>

                  {/* Quantity + Unit */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={pendingQuantity}
                        onChange={e => setPendingQuantity(e.target.value)}
                        className="w-20 text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                      <select
                        value={pendingUnit}
                        onChange={e => setPendingUnit(e.target.value as IngredientUnit)}
                        className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                      >
                        {INGREDIENT_UNITS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Area */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Where does it live?</p>
                    <div className="flex flex-wrap gap-2">
                      {AREAS.map(({ value, emoji, label }) => (
                        <button
                          key={value}
                          onClick={() => setPendingArea(value)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors',
                            pendingArea === value
                              ? 'bg-primary/15 text-primary border-primary/30'
                              : 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80'
                          )}
                        >
                          <span>{emoji}</span>{label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date type toggle + picker */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Date</p>
                    <div className="flex gap-2 mb-2">
                      {(['use-by', 'bought'] as const).map(dt => (
                        <button
                          key={dt}
                          onClick={() => setPendingDateType(dt)}
                          className={cn(
                            'flex-1 py-1.5 text-sm rounded-lg border transition-colors',
                            pendingDateType === dt
                              ? 'bg-primary/15 text-primary border-primary/30'
                              : 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80'
                          )}
                        >
                          {dt === 'use-by' ? 'Use by date' : 'Bought date'}
                        </button>
                      ))}
                    </div>

                    {pendingDateType === 'use-by' ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input
                          type="date"
                          value={pendingDate}
                          onChange={e => setPendingDate(e.target.value)}
                          className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        {pendingDate && (
                          <button onClick={() => setPendingDate('')} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                          <input
                            type="date"
                            value={pendingBoughtDate}
                            onChange={e => setPendingBoughtDate(e.target.value)}
                            className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                          {pendingBoughtDate && (
                            <button onClick={() => setPendingBoughtDate('')} className="text-muted-foreground hover:text-foreground">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {expectedExpiry && (
                          <p className="text-[11px] text-muted-foreground pl-6">
                            Expected to last until{' '}
                            <span className="font-medium text-foreground">{formatDate(expectedExpiry)}</span>
                            {' '}· {getShelfLifeDays(pendingName!)}d shelf life
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <Button size="sm" onClick={handleConfirmAdd} className="w-full rounded-full gap-2">
                    <Plus className="w-4 h-4" />
                    Add {pendingSubtype
                      ? `${displayName(pendingName)} ${pendingSubtype}`
                      : displayName(pendingName)}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Selected ingredients ── */}
          {preferences.ingredients.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Your ingredients ({preferences.ingredients.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {preferences.ingredients.map(ingredient => {
                    const effectiveDate = getEffectiveUseByDate(ingredient)
                    const days = getDaysUntilExpiry(effectiveDate)
                    const isRed   = days !== null && days <= 1
                    const isAmber = days !== null && days === 2
                    const cfg = areaConfig(ingredient.area)
                    const label = ingredient.displayName ?? displayName(ingredient.name)
                    const showQty = ingredient.quantity &&
                      (ingredient.quantity !== '1' || ingredient.unit !== 'pieces')

                    return (
                      <motion.button
                        key={ingredient.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        layout
                        onClick={() => removeIngredient(ingredient.name)}
                        className={cn(
                          'group flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors',
                          isRed
                            ? 'bg-red-500/10 text-red-700 border-red-500/20 hover:bg-red-500/20 dark:text-red-400 dark:border-red-400/20 dark:bg-red-400/10'
                            : isAmber
                              ? 'bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20 dark:text-amber-400 dark:border-amber-400/20 dark:bg-amber-400/10'
                              : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                        )}
                      >
                        {showQty && (
                          <span className="text-xs opacity-75">{ingredient.quantity} {ingredient.unit}</span>
                        )}
                        <span className="text-xs opacity-80">{cfg.emoji}</span>
                        <span className="text-sm">{label}</span>
                        {isRed && <span className="text-xs font-medium opacity-90">Use today!</span>}
                        <X className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 shrink-0" />
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* ── Quick-add chips ── */}
          {(() => {
            const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
            const label = safeFoodsActive
              ? preferences.ingredients.length === 0 ? 'Your safe ingredients:' : 'Add more from your safe list:'
              : preferences.ingredients.length === 0 ? 'Try adding:' : 'Quick add more:'

            const isFlagged = (name: string) =>
              hasUserAllergen(name, preferences.allergens, preferences.customAllergens)

            const quickAddList = safeFoodsActive
              ? preferences.safeIngredients.filter(name => !isFlagged(name))
              : POPULAR_POOL.filter(name => !isFlagged(name)).slice(0, QUICK_ADD_COUNT)

            return (
              <div className="flex-1">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{label}</h3>
                <div className="flex flex-wrap gap-2">
                  {quickAddList.map(name => {
                    const selected = addedNames.has(name)
                    return (
                      <button
                        key={name}
                        onClick={() => selected ? removeIngredient(name) : handleQuickAdd(name)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors',
                          selected
                            ? 'bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        )}
                      >
                        {selected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 opacity-50" />}
                        {displayName(name)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── Filters ── */}
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Meal type</h3>
              <div className="flex flex-wrap gap-2">
                {MEAL_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setMealType(value)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-full transition-colors',
                      mealType === value
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Cook time</h3>
              <div className="flex flex-wrap gap-2">
                {COOK_TIMES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setCookTime(value)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-full transition-colors',
                      cookTime === value
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    )}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Kitchen-only toggle */}
            <div className="flex items-center justify-between gap-4 py-0.5">
              <div>
                <p className="text-sm font-medium text-foreground">Use my kitchen only</p>
                <p className="text-xs text-muted-foreground">No extras — recipes use exactly what you&apos;ve added</p>
              </div>
              <button
                role="switch"
                aria-checked={kitchenOnly}
                onClick={() => setKitchenOnly(v => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  kitchenOnly ? 'bg-green-500' : 'bg-secondary'
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                  kitchenOnly ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="pt-4 border-t border-border space-y-3 mt-6">
            <Button
              size="lg"
              onClick={() => onGenerateRecipe(filters)}
              disabled={preferences.ingredients.length === 0}
              className="w-full rounded-full gap-2 py-6"
            >
              <Sparkles className="w-5 h-5" />
              Generate Recipe
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => onShowPairings(filters)}
              disabled={preferences.ingredients.length === 0}
              className="w-full rounded-full gap-2"
            >
              <Layers className="w-5 h-5" />
              Show Pairings
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {preferences.safeFoodsMode && preferences.safeIngredients.length > 0
                ? 'Recipes will use only ingredients from your safe foods list'
                : "We'll find recipes that match your ingredients and avoid your allergens"}
            </p>
          </div>

        </div>
      </div>

      {/* Autocomplete dropdown */}
      {isMounted && createPortal(
        <AnimatePresence>
          {showDropdown && dropdownItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 200 }}
              className="bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            >
              {dropdownItems.map((name, index) => (
                <button
                  key={name}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelectFromSearch(name)}
                  className={cn(
                    'w-full text-left px-4 py-3 text-foreground hover:bg-secondary transition-colors',
                    index !== dropdownItems.length - 1 && 'border-b border-border'
                  )}
                >
                  <Plus className="w-4 h-4 inline-block mr-2 text-muted-foreground" />
                  {displayName(name)}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
