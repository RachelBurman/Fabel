'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useSession } from '@/lib/auth-client'
import { useFable } from '@/lib/fable-context'
import { type IngredientArea, type IngredientUnit, type IngredientItem, INGREDIENT_UNITS } from '@/lib/types'
import { type VisionResult } from '@/lib/vision-scanner'
import { detectBarcodeFromFile } from '@/lib/barcode-scanner'
import { getShelfLifeDays, addDays, getEffectiveUseByDate } from '@/lib/shelf-life'
import { computeServingWarnings } from '@/lib/serving-warnings'
import { Plus, X, Search, Camera, ChefHat, Sparkles, Layers, Calendar, ArrowLeftRight, ChevronLeft, ChevronRight, Minus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { VisionReviewScreen } from '@/components/vision-review-screen'
import allergenMapData from '@/data/allergen-map.json'
import { useIngredientSearch } from '@/lib/hooks/use-ingredient-search'
import { CUISINES } from '@/lib/cuisines'
import { useScanBarcode } from '@/lib/hooks/use-scan-barcode'
import { useScanIngredients } from '@/lib/hooks/use-scan-ingredients'

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
  cuisine: string   // '' = any cuisine
  occasion: string  // '' = no specific occasion
  servings: number
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


const CUISINES_INITIAL_COUNT = 4 // shown collapsed before "More cuisines +"

const OCCASIONS: { value: string; label: string }[] = [
  { value: 'Weeknight',      label: 'Weeknight' },
  { value: 'Dinner Party',   label: 'Dinner Party' },
  { value: 'Street Food',    label: 'Street Food' },
  { value: 'Comfort Food',   label: 'Comfort Food' },
  { value: 'Packed Lunch',   label: 'Packed Lunch' },
  { value: 'Romantic Dinner',label: 'Romantic Dinner' },
  { value: 'Meal Prep',      label: 'Meal Prep' },
  { value: 'Celebration',    label: 'Celebration' },
]

const OCCASION_I18N_KEYS: Record<string, string> = {
  'Weeknight': 'weeknight',
  'Dinner Party': 'dinnerParty',
  'Street Food': 'streetFood',
  'Comfort Food': 'comfortFood',
  'Packed Lunch': 'packedLunch',
  'Romantic Dinner': 'romanticDinner',
  'Meal Prep': 'mealPrep',
  'Celebration': 'celebration',
}

const EQUIPMENT_OPTIONS: { value: string; label: string; defaultOn: boolean }[] = [
  { value: 'hob',         label: '🔥 Hob',           defaultOn: true  },
  { value: 'oven',        label: '🫙 Oven',           defaultOn: true  },
  { value: 'microwave',   label: '📦 Microwave',      defaultOn: false },
  { value: 'air_fryer',   label: '💨 Air Fryer',      defaultOn: false },
  { value: 'slow_cooker', label: '🐢 Slow Cooker',    defaultOn: false },
  { value: 'pizza_oven',  label: '🍕 Pizza Oven',     defaultOn: false },
  { value: 'barbecue',    label: '🔥 Barbecue/Grill', defaultOn: false },
  { value: 'instant_pot', label: '⚡ Instant Pot',    defaultOn: false },
]

// computeServingWarnings imported from @/lib/serving-warnings

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

// ─── Image compression ────────────────────────────────────────────────────────

function compressImageToBase64(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No canvas context')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl.split(',')[1])
    }
    img.onerror = () => {
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
        file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
      reject(new Error(isHeic ? 'heic-unsupported' : 'load-failed'))
    }
    img.src = url
  })
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

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, onNavigate }: { step: 1 | 2; onNavigate: (s: 1 | 2) => void }) {
  const tK = useTranslations('kitchen')
  return (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={() => onNavigate(1)} className="flex items-center gap-2">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
          step === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
        )}>1</div>
        <span className={cn('text-sm font-medium transition-colors', step === 1 ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {tK('stepKitchen')}
        </span>
      </button>
      <div className="w-8 h-px bg-border" />
      <button onClick={() => onNavigate(2)} className="flex items-center gap-2">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
          step === 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
        )}>2</div>
        <span className={cn('text-sm font-medium transition-colors', step === 2 ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {tK('stepPreferences')}
        </span>
      </button>
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function IngredientsHeader({ safeFoodsActive }: { safeFoodsActive: boolean }) {
  const tK = useTranslations('kitchen')
  return (
    <div className="text-center mb-5">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
        style={safeFoodsActive
          ? { backgroundColor: 'rgba(34,197,94,0.12)' }
          : { backgroundColor: 'var(--primary-10, oklch(0.55 0.12 145 / 0.1))' }}
      >
        <ChefHat
          className="w-6 h-6"
          style={safeFoodsActive ? { color: '#16a34a' } : { color: 'var(--primary)' }}
        />
      </div>
      <h1 className="text-xl md:text-2xl font-semibold text-foreground mb-1 text-balance">
        {safeFoodsActive ? tK('safeHeaderTitle') : tK('regularHeaderTitle')}
      </h1>
      <p className="text-sm text-muted-foreground text-pretty">
        {safeFoodsActive ? tK('safeHeaderDesc') : tK('regularHeaderDesc')}
      </p>
    </div>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface IngredientsScreenProps {
  onShowPairings: (filters: RecipeFilters) => void
  onGenerateRecipe: (filters: RecipeFilters) => void
  onFindSubstitutes: () => void
  onOpenAuth?: () => void
}

export function IngredientsScreen({ onShowPairings, onGenerateRecipe, onFindSubstitutes, onOpenAuth }: IngredientsScreenProps) {
  const t = useTranslations('recipe')
  const tK = useTranslations('kitchen')
  const tSub = useTranslations('substitutes')
  const { data: session } = useSession()
  const isSignedIn = !!session?.user
  const { preferences, addIngredient, removeIngredient, setIngredients, effectiveAllergens, effectiveCustomAllergens, toggleKitchenEquipment } = useFable()
  const showLactoseTag = preferences.lactoseIntolerant && preferences.lactoseMode === 'include'
  const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0

  const [inputValue, setInputValue] = useState('')
  const [debouncedInput, setDebouncedInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Step navigation
  const [step, setStep] = useState<1 | 2>(1)

  // Staging state
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [pendingArea, setPendingArea] = useState<IngredientArea>('fridge')
  const [pendingSubtype, setPendingSubtype] = useState('')
  const [pendingQuantity, setPendingQuantity] = useState('1')
  const [pendingUnit, setPendingUnit] = useState<IngredientUnit>('pieces')
  const [pendingDateType, setPendingDateType] = useState<'use-by' | 'bought'>('use-by')
  const [pendingDate, setPendingDate] = useState('')
  const [pendingBoughtDate, setPendingBoughtDate] = useState('')

  // Filter state
  const [mealType, setMealType] = useState<MealType>('main')
  const [cookTime, setCookTime] = useState<CookTime>('medium')
  const [kitchenOnly, setKitchenOnly] = useState(false)
  const [cuisine, setCuisine] = useState('')
  const [occasion, setOccasion] = useState('')
  const [servings, setServings] = useState(2)
  const [cuisineExpanded, setCuisineExpanded] = useState(false)

  // Vision scanner state
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [visionLoading, setVisionLoading] = useState(false)
  const [visionResult, setVisionResult] = useState<VisionResult | null>(null)
  const [cameraAuthPrompt, setCameraAuthPrompt] = useState(false)

  // Portal dropdown positioning
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedInput(inputValue.trim()), 150)
    return () => clearTimeout(id)
  }, [inputValue])

  const recomputeCoords = useCallback(() => {
    if (inputWrapperRef.current) {
      const r = inputWrapperRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 8, left: r.left, width: r.width })
    }
  }, [])

  const ingredientSearch = useIngredientSearch(debouncedInput)
  const searchResults = ingredientSearch.data ?? []

  useEffect(() => {
    if (searchResults.length > 0) recomputeCoords()
  }, [searchResults, recomputeCoords])

  useEffect(() => {
    if (showDropdown) recomputeCoords()
  }, [showDropdown, recomputeCoords])

  const scanBarcodeMutation = useScanBarcode()
  const scanIngredientsMutation = useScanIngredients()

  // Scroll to top when changing steps
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

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

  const handleCameraInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setVisionLoading(true)
    try {
      const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null

      // Step 1: attempt barcode detection — fast, in-browser, no server call needed
      const barcode = await detectBarcodeFromFile(file)
      if (barcode) {
        const data = await scanBarcodeMutation.mutateAsync({ barcode, userId: uid })
        if (data.ingredients && data.ingredients.length > 0) {
          setVisionResult(data as unknown as VisionResult)
          return
        }
        // Barcode found but product lookup failed — fall through to vision scan
      }

      // Step 2: vision scan
      const base64 = await compressImageToBase64(file, 1200, 0.82)
      const result = await scanIngredientsMutation.mutateAsync({ image: base64, mediaType: 'image/jpeg', userId: uid })

      if (result.statusCode === 429) {
        const time = result.resetAt
          ? new Date(result.resetAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          : 'soon'
        toast.error(tK('photoRateLimitError', { time }))
        return
      }
      if (result.error) {
        if (result.error === 'Vision Lambda not configured') {
          toast.error(tK('photoNotSetupError'))
        } else {
          toast.error(tK('photoCantReadError'))
        }
        return
      }
      if (!result.ingredients || result.ingredients.length === 0) {
        toast.error(tK('photoNoIngredientsError'))
        return
      }
      setVisionResult({ ingredients: result.ingredients } as unknown as VisionResult)
    } catch (err) {
      if (err instanceof Error && err.message === 'heic-unsupported') {
        toast.error(tK('photoHeicError'))
      } else {
        toast.error(tK('photoGenericError'))
      }
    } finally {
      setVisionLoading(false)
    }
  }, [scanBarcodeMutation, scanIngredientsMutation]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleVisionConfirm = useCallback((newItems: IngredientItem[]) => {
    setIngredients([...preferences.ingredients, ...newItems])
    setVisionResult(null)
    toast.success(newItems.length !== 1 ? tK('photoSuccessToastPlural', { count: newItems.length }) : tK('photoSuccessToast', { count: newItems.length }))
  }, [preferences.ingredients, setIngredients])

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

  const handleGoToStep2 = () => {
    resetStaging()
    setStep(2)
  }

  const expectedExpiry = pendingName && pendingBoughtDate
    ? addDays(pendingBoughtDate, getShelfLifeDays(pendingName))
    : null

  const dropdownItems = searchResults.filter(r => !preferences.ingredients.some(i => i.name === r))
  const addedNames = new Set(preferences.ingredients.map(i => i.name))
  const filters: RecipeFilters = { mealType, cookTime, kitchenOnly, cuisine, occasion, servings }

  // Cuisine: auto-expand if selected cuisine is in the hidden portion
  const cuisineIsHidden = cuisine !== '' && !CUISINES.slice(0, CUISINES_INITIAL_COUNT).find(c => c.value === cuisine)
  const showAllCuisines = cuisineExpanded || cuisineIsHidden
  const visibleCuisines = showAllCuisines ? CUISINES : CUISINES.slice(0, CUISINES_INITIAL_COUNT)

  // Serving size warnings — only when servings > 2
  const servingWarnings = computeServingWarnings(preferences.ingredients, servings)

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-4 md:py-8">
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

          <StepIndicator step={step} onNavigate={setStep} />

          <AnimatePresence mode="wait">

            {/* ══ Step 1: Your Kitchen ══════════════════════════════════════ */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col flex-1"
              >
                <IngredientsHeader safeFoodsActive={safeFoodsActive} />

                {/* Search */}
                <div className="relative mb-3">
                  <div ref={inputWrapperRef} className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={tK('searchPlaceholder')}
                      maxLength={100}
                      value={inputValue}
                      onChange={e => { setInputValue(e.target.value); setShowDropdown(e.target.value.length > 0) }}
                      onKeyDown={handleInputKeyDown}
                      onFocus={() => { if (inputValue.length > 0) setShowDropdown(true); recomputeCoords() }}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      className="pl-12 pr-12 py-6 text-base rounded-xl bg-card border-border"
                    />
                    <button
                      onClick={() => {
                        if (!isSignedIn) { setCameraAuthPrompt(true); return }
                        cameraInputRef.current?.click()
                      }}
                      disabled={visionLoading}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                      aria-label="Scan ingredients from photo"
                    >
                      {visionLoading
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <Camera className="w-5 h-5" />}
                    </button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleCameraInput}
                    />
                  </div>
                  {visionLoading && (
                    <p className="text-xs text-muted-foreground mt-1.5 text-center animate-pulse">
                      {tK('analysingKitchen')}
                    </p>
                  )}
                  {cameraAuthPrompt && !isSignedIn && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {tK('cameraAuthPrompt')}{' '}
                      <button
                        onClick={onOpenAuth}
                        className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                      >
                        {tK('cameraAuthLink')}
                      </button>
                      {' '}{tK('cameraAuthSuffix')}
                    </p>
                  )}
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

                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{displayName(pendingName)}</span>
                          <button onClick={resetStaging} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{tK('specifyType')} <span className="opacity-60">{tK('optional')}</span></p>
                          <input
                            type="text"
                            placeholder={tK('subtypePlaceholder')}
                            value={pendingSubtype}
                            onChange={e => setPendingSubtype(e.target.value)}
                            className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                          />
                          <p className="text-[11px] text-muted-foreground/60 mt-1">{tK('typeHint')}</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{tK('quantity')}</p>
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

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">{tK('storageArea')}</p>
                          <div className="flex flex-wrap gap-2">
                            {AREAS.map(({ value, emoji }) => (
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
                                <span>{emoji}</span>{tK(`areas.${value}`)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">{tK('dateLabel')}</p>
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
                                {dt === 'use-by' ? tK('useByDate') : tK('boughtDate')}
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
                                  {tK('expectedExpiryPrefix')}{' '}
                                  <span className="font-medium text-foreground">{formatDate(expectedExpiry)}</span>
                                  {' '}· {getShelfLifeDays(pendingName!)}{tK('shelfLifeSuffix')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <Button size="sm" onClick={handleConfirmAdd} className="w-full rounded-full gap-2">
                          <Plus className="w-4 h-4" />
                          {tK('addButton', { name: pendingSubtype
                            ? `${displayName(pendingName)} ${pendingSubtype}`
                            : displayName(pendingName) })}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Selected ingredients ── */}
                {preferences.ingredients.length > 0 && (
                  <div className="mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {tK('yourIngredients', { count: preferences.ingredients.length })}
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
                              {showLactoseTag && (allergenMap[ingredient.name] ?? []).includes('milk') && (
                                <span className="text-xs opacity-75" title="Contains lactose">🥛</span>
                              )}
                              {isRed && <span className="text-xs font-medium opacity-90">{tK('expiry.useToday')}!</span>}
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
                  const label = safeFoodsActive
                    ? preferences.ingredients.length === 0 ? tK('safeIngredientsList') : tK('addMoreFromSafe')
                    : preferences.ingredients.length === 0 ? tK('tryAdding') : tK('quickAddMore')

                  const isFlagged = (name: string) =>
                    hasUserAllergen(name, effectiveAllergens, effectiveCustomAllergens)

                  const quickAddList = safeFoodsActive
                    ? preferences.safeIngredients.filter(name => !isFlagged(name) && !addedNames.has(name))
                    : POPULAR_POOL.filter(name => !isFlagged(name) && !addedNames.has(name)).slice(0, QUICK_ADD_COUNT)

                  return (
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">{label}</h3>
                      <div className="flex flex-wrap gap-2">
                        {quickAddList.map(name => (
                          <button
                            key={name}
                            onClick={() => handleQuickAdd(name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          >
                            <Plus className="w-3.5 h-3.5 opacity-50" />
                            {displayName(name)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* ── Next ── */}
                <div className="pt-4 mt-4 border-t border-border">
                  <Button
                    size="lg"
                    onClick={handleGoToStep2}
                    className="w-full rounded-full gap-2"
                  >
                    {tK('nextButton')}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ══ Step 2: Recipe Preferences ═══════════════════════════════ */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col flex-1"
              >
                {/* Back */}
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 self-start"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {tK('backToKitchen')}
                </button>

                <h2 className="text-xl font-semibold text-foreground mb-6">{tK('recipePreferences')}</h2>

                {/* ── Filters ── */}
                <div className="space-y-4">

                  {/* Meal type */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('mealType')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {MEAL_TYPES.map(({ value }) => (
                        <button
                          key={value}
                          onClick={() => setMealType(value)}
                          className={cn(
                            'px-3 py-1.5 text-sm rounded-full transition-colors',
                            mealType === value
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                          )}
                        >{t(`mealTypes.${value}`)}</button>
                      ))}
                    </div>
                  </div>

                  {/* Cook time */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('cookTime')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {COOK_TIMES.map(({ value }) => (
                        <button
                          key={value}
                          onClick={() => setCookTime(value)}
                          className={cn(
                            'px-3 py-1.5 text-sm rounded-full transition-colors',
                            cookTime === value
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                          )}
                        >{t(`cookTimes.${value}`)}</button>
                      ))}
                    </div>
                  </div>

                  {/* Cuisine */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('cuisine')}</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setCuisine('')}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-full transition-colors',
                          cuisine === ''
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        )}
                      >{tK('anyCuisine')}</button>
                      {visibleCuisines.map(({ value }) => (
                        <button
                          key={value}
                          onClick={() => setCuisine(cuisine === value ? '' : value)}
                          className={cn(
                            'px-3 py-1.5 text-sm rounded-full transition-colors',
                            cuisine === value
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                          )}
                        >{t(`cuisines.${value}`)}</button>
                      ))}
                      {!showAllCuisines && (
                        <button
                          onClick={() => setCuisineExpanded(true)}
                          className="px-3 py-1.5 text-sm rounded-full transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        >
                          {tK('moreCuisines')}
                        </button>
                      )}
                      {cuisineExpanded && (
                        <button
                          onClick={() => setCuisineExpanded(false)}
                          className="px-3 py-1.5 text-sm rounded-full transition-colors bg-secondary text-muted-foreground hover:bg-secondary/80"
                        >
                          {tK('showLess')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Occasion */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('occasion')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {OCCASIONS.map(({ value }) => (
                        <button
                          key={value}
                          onClick={() => setOccasion(occasion === value ? '' : value)}
                          className={cn(
                            'px-3 py-1.5 text-sm rounded-full transition-colors',
                            occasion === value
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                          )}
                        >{t(`occasions.${OCCASION_I18N_KEYS[value] ?? value}`)}</button>
                      ))}
                    </div>
                  </div>

                  {/* Servings */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('servings')}</h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setServings(v => Math.max(1, v - 1))}
                        disabled={servings <= 1}
                        className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40 transition-colors"
                        aria-label="Decrease servings"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-16 text-center text-base font-medium text-foreground">
                        {servings} {servings === 1 ? tK('servingLabel') : tK('servingsLabel')}
                      </span>
                      <button
                        onClick={() => setServings(v => Math.min(12, v + 1))}
                        disabled={servings >= 12}
                        className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40 transition-colors"
                        aria-label="Increase servings"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Kitchen equipment */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('equipment')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {EQUIPMENT_OPTIONS.map(({ value, label }) => {
                        const isOn = preferences.kitchenEquipment.includes(value)
                        return (
                          <button
                            key={value}
                            onClick={() => toggleKitchenEquipment(value)}
                            className={cn(
                              'px-3 py-1.5 text-sm rounded-full transition-colors',
                              isOn
                                ? 'bg-primary/15 text-primary border border-primary/30'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            )}
                          >{label}</button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Kitchen-only toggle */}
                  <div className="flex items-center justify-between gap-4 py-0.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{tK('useKitchenOnly')}</p>
                      <p className="text-xs text-muted-foreground">{tK('noExtras')}</p>
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

                {/* ── Serving size warning ── */}
                {servingWarnings.length > 0 && (
                  <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex gap-3 items-start">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {tK('servingWarning', { items: servingWarnings.join(', '), count: servings })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tK('servingWarningNote')}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Actions ── */}
                <div className="pt-4 border-t border-border space-y-3 mt-6">
                  <Button
                    size="lg"
                    onClick={() => onGenerateRecipe(filters)}
                    disabled={preferences.ingredients.length === 0}
                    className="w-full rounded-full gap-2 py-6"
                  >
                    <Sparkles className="w-5 h-5" />
                    {t('generate')}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onShowPairings(filters)}
                    disabled={preferences.ingredients.length === 0}
                    className="w-full rounded-full gap-2"
                  >
                    <Layers className="w-5 h-5" />
                    {t('findPairings')}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={onFindSubstitutes}
                    disabled={preferences.ingredients.length === 0}
                    className="w-full rounded-full gap-2"
                  >
                    <ArrowLeftRight className="w-5 h-5" />
                    {tSub('findSubstitutes')}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    {safeFoodsActive ? tK('safeFoodsFooter') : tK('regularFooter')}
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>
      </div>

      {/* Vision review screen */}
      <AnimatePresence>
        {visionResult && (
          <VisionReviewScreen
            result={visionResult}
            existingKitchenKeys={preferences.ingredients.map(i => i.name)}
            onConfirm={handleVisionConfirm}
            onCancel={() => setVisionResult(null)}
          />
        )}
      </AnimatePresence>

      {/* Autocomplete dropdown — portal to body for z-index */}
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
