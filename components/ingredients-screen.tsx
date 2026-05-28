'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFable } from '@/lib/fable-context'
import { Plus, X, Search, ChefHat, Sparkles, Layers, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import allergenMapData from '@/data/allergen-map.json'

const allergenMap = allergenMapData as Record<string, string[]>

/** True if the ingredient contains any of the user's selected allergens or custom blocks. */
function hasUserAllergen(
  ingredient: string,
  userAllergens: string[],
  customAllergens: string[]
): boolean {
  if (customAllergens.includes(ingredient)) return true
  const codes = allergenMap[ingredient] ?? []
  return codes.some(code => userAllergens.includes(code))
}

// ─── Filter types ─────────────────────────────────────────────────────────────

export type MealType = 'snack' | 'starter' | 'main' | 'dessert'
export type CookTime = 'quick' | 'medium' | 'slow'

export interface RecipeFilters {
  mealType: MealType
  cookTime: CookTime
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

// ─── Component ────────────────────────────────────────────────────────────────

// Extended pool of popular ingredients. The quick-add list is built by
// taking the first 12 entries that don't conflict with the user's allergens.
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
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

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

interface IngredientsScreenProps {
  onShowPairings: (filters: RecipeFilters) => void
  onGenerateRecipe: (filters: RecipeFilters) => void
}

export function IngredientsScreen({ onShowPairings, onGenerateRecipe }: IngredientsScreenProps) {
  const { preferences, addIngredient, removeIngredient } = useFable()
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<string[]>([])

  // Filter state
  const [mealType, setMealType] = useState<MealType>('main')
  const [cookTime, setCookTime] = useState<CookTime>('medium')

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

  // Debounced search against the Epicure ingredient list
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

  const handleAddIngredient = useCallback((ingredient: string) => {
    addIngredient(ingredient)
    setInputValue('')
    setSearchResults([])
    setShowDropdown(false)
  }, [addIngredient])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleAddIngredient(
        dropdownItems.length > 0
          ? dropdownItems[0]
          : inputValue.trim().toLowerCase().replace(/\s+/g, '_')
      )
    }
    if (e.key === 'Escape') setShowDropdown(false)
  }

  const dropdownItems = searchResults.filter(r => !preferences.ingredients.includes(r))
  const filters: RecipeFilters = { mealType, cookTime }

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

          {/* Header — label changes when Safe Foods Mode is active */}
          <IngredientsHeader safeFoodsActive={preferences.safeFoodsMode && preferences.safeIngredients.length > 0} />

          {/* Search input */}
          <div className="relative mb-6">
            <div ref={inputWrapperRef} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search 1,790 ingredients…"
                value={inputValue}
                onChange={e => {
                  setInputValue(e.target.value)
                  setShowDropdown(e.target.value.length > 0)
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => {
                  if (inputValue.length > 0) setShowDropdown(true)
                  recomputeCoords()
                }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="pl-12 pr-4 py-6 text-base rounded-xl bg-card border-border"
              />
            </div>
          </div>

          {/* Selected ingredients */}
          {preferences.ingredients.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Your ingredients ({preferences.ingredients.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {preferences.ingredients.map(ingredient => (
                    <motion.button
                      key={ingredient}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      layout
                      onClick={() => removeIngredient(ingredient)}
                      className="group flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full border border-primary/20 hover:bg-primary/20 transition-colors"
                    >
                      <span>{displayName(ingredient)}</span>
                      <X className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Quick-add chips */}
          {(() => {
            const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
            const label = safeFoodsActive
              ? preferences.ingredients.length === 0 ? 'Your safe ingredients:' : 'Add more from your safe list:'
              : preferences.ingredients.length === 0 ? 'Try adding:' : 'Quick add more:'

            // Build the displayed list, excluding allergen-flagged items.
            // In default mode: draw from POPULAR_POOL until we have QUICK_ADD_COUNT safe ones.
            // In safe foods mode: show all of the user's safe ingredients that aren't flagged.
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
                const selected = preferences.ingredients.includes(name)
                return (
                  <button
                    key={name}
                    onClick={() => selected ? removeIngredient(name) : handleAddIngredient(name)}
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
            {/* Meal type */}
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
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cook time */}
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
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
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
                : 'We\'ll find recipes that match your ingredients and avoid your allergens'}
            </p>
          </div>

        </div>
      </div>

      {/* Autocomplete dropdown — portal to escape stacking contexts */}
      {isMounted && createPortal(
        <AnimatePresence>
          {showDropdown && dropdownItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 200,
              }}
              className="bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            >
              {dropdownItems.map((name, index) => (
                <button
                  key={name}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleAddIngredient(name)}
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
