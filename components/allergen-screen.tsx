'use client'

import { motion } from 'framer-motion'
import { ALLERGENS } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Check, ArrowLeft, ShieldCheck, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CustomAllergenSearch } from '@/components/custom-allergen-search'

interface AllergenScreenProps {
  onDone: () => void
  onManageSafeFoods?: () => void
}

export function AllergenScreen({ onDone, onManageSafeFoods }: AllergenScreenProps) {
  const { preferences, toggleAllergen, setSafeFoodsMode, setShowMacros } = useFable()
  const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0

  const totalCount = preferences.allergens.length + (preferences.customAllergens?.length ?? 0)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={onDone}
              className="shrink-0 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Allergen Settings</h1>
              <p className="text-sm text-muted-foreground">
                {totalCount === 0 ? 'No restrictions selected' : `${totalCount} restriction${totalCount > 1 ? 's' : ''} active`}
              </p>
            </div>
          </div>

          {/* EU Big 14 grid — fills available height */}
          <h2 className="text-sm font-medium text-muted-foreground mb-2">EU Big 14 Allergens</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-3">
            {ALLERGENS.map((allergen, index) => {
              const isSelected = preferences.allergens.includes(allergen.id)
              return (
                <motion.button
                  key={allergen.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02, duration: 0.15 }}
                  onClick={() => toggleAllergen(allergen.id)}
                  className={cn(
                    'relative aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 transition-all duration-200',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </motion.div>
                  )}
                  <span className="text-3xl">{allergen.icon}</span>
                  <span className={cn('text-xs font-medium text-center leading-tight', isSelected ? 'text-primary' : 'text-foreground')}>
                    {allergen.name}
                  </span>
                </motion.button>
              )
            })}
          </div>

          <div className="mb-4">
            <CustomAllergenSearch />
          </div>

          {/* Safe Foods Mode section */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" style={{ color: '#16a34a' }} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Safe Foods Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {preferences.safeIngredients.length === 0
                      ? 'No safe ingredients configured'
                      : `${preferences.safeIngredients.length} ingredients on your safe list`}
                  </p>
                </div>
              </div>
              {/* Toggle */}
              <button
                onClick={() => setSafeFoodsMode(!preferences.safeFoodsMode)}
                disabled={preferences.safeIngredients.length === 0}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40"
                style={{ backgroundColor: safeFoodsActive ? '#22c55e' : '#9ca3af' }}
                aria-label="Toggle Safe Foods Mode"
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-slate-200 shadow transition-transform',
                    safeFoodsActive ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {!safeFoodsActive && (
              <p className="text-xs text-muted-foreground mb-3">
                For MCAS, severe allergies, or highly restricted diets. Build a list of
                ingredients you can safely eat and we&apos;ll generate recipes exclusively from it.
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onManageSafeFoods}
              className="w-full rounded-full gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {preferences.safeIngredients.length === 0 ? 'Set up safe foods list' : 'Manage safe foods list'}
            </Button>
          </div>

          {/* Nutritional information toggle */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Show nutritional information</p>
                  <p className="text-xs text-muted-foreground">Calories, protein, carbs and fat per serving</p>
                </div>
              </div>
              <button
                onClick={() => setShowMacros(!preferences.showMacros)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: preferences.showMacros ? '#22c55e' : '#9ca3af' }}
                aria-label="Toggle nutritional information"
              >
                <span className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-slate-200 shadow transition-transform',
                  preferences.showMacros ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2.5">
              Calorie and macro information is hidden by default out of respect for users in eating disorder recovery.
            </p>
          </div>

          {/* Done button */}
          <div className="pt-4 border-t border-border mt-auto">
            <Button size="lg" onClick={onDone} className="w-full rounded-full py-6">
              Done
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}
