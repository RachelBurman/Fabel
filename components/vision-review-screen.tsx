'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  buildReviewIngredients,
  buildKitchenIngredients,
  type VisionResult,
  type ReviewIngredient,
} from '@/lib/vision-scanner'
import { type IngredientArea, type IngredientItem } from '@/lib/types'
import { useTranslations } from 'next-intl'

const AREAS: { value: IngredientArea; emoji: string; labelKey: string }[] = [
  { value: 'fridge',   emoji: '🧊', labelKey: 'fridge' },
  { value: 'freezer',  emoji: '❄️', labelKey: 'freezer' },
  { value: 'cupboard', emoji: '🗄️', labelKey: 'cupboard' },
  { value: 'pantry',   emoji: '🏠', labelKey: 'pantry' },
]

interface VisionReviewScreenProps {
  result: VisionResult
  existingKitchenKeys: string[]
  onConfirm: (ingredients: IngredientItem[]) => void
  onCancel: () => void
}

export function VisionReviewScreen({
  result,
  existingKitchenKeys,
  onConfirm,
  onCancel,
}: VisionReviewScreenProps) {
  const t = useTranslations('visionReview')
  const tKitchen = useTranslations('kitchen')
  const defaultArea: IngredientArea =
    result.inferredArea !== 'unknown' ? result.inferredArea : 'fridge'

  const [area, setArea] = useState<IngredientArea>(defaultArea)
  const [showAreaPicker, setShowAreaPicker] = useState(false)
  const [ingredients, setIngredients] = useState<ReviewIngredient[]>(
    () => buildReviewIngredients(result.ingredients, existingKitchenKeys)
  )

  const checkedCount = ingredients.filter(i => i.checked).length
  const areaConfig = AREAS.find(a => a.value === area) ?? AREAS[0]

  const toggleIngredient = (epicureKey: string) => {
    setIngredients(prev =>
      prev.map(i => i.epicureKey === epicureKey ? { ...i, checked: !i.checked } : i)
    )
  }

  const handleConfirm = () => {
    if (checkedCount === 0) {
      onCancel()
      return
    }
    const now = new Date().toISOString().split('T')[0]
    const items = buildKitchenIngredients(ingredients, area, now)
    onConfirm(items)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {result.ingredients.length !== 1 ? t('foundIngredients', { count: result.ingredients.length }) : t('foundOneIngredient')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('selectToAdd')}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Area selector */}
      <div className="px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t('storageArea')}</span>
          <div className="relative">
            <button
              onClick={() => setShowAreaPicker(p => !p)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                result.areaConfident
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-secondary text-muted-foreground border-border'
              )}
            >
              {areaConfig.emoji} {tKitchen(`areas.${areaConfig.labelKey}` as Parameters<typeof tKitchen>[0])}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showAreaPicker && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                {AREAS.map(a => (
                  <button
                    key={a.value}
                    onClick={() => { setArea(a.value); setShowAreaPicker(false) }}
                    className={cn(
                      'flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-secondary',
                      area === a.value && 'text-primary font-medium'
                    )}
                  >
                    {a.emoji} {tKitchen(`areas.${a.labelKey}` as Parameters<typeof tKitchen>[0])}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!result.areaConfident && (
            <span className="text-xs text-muted-foreground">{t('guessed')}</span>
          )}
        </div>
      </div>

      {/* Ingredient list */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {ingredients.map(ing => (
          <button
            key={ing.epicureKey}
            onClick={() => toggleIngredient(ing.epicureKey)}
            className={cn(
              'w-full flex items-center gap-3 py-3 border-b border-border/50 text-left transition-colors',
              'hover:bg-secondary/30 rounded-lg px-2 -mx-2'
            )}
          >
            {/* Checkbox */}
            <div className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
              ing.checked
                ? 'bg-primary border-primary'
                : 'border-border'
            )}>
              {ing.checked && (
                <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            {/* Names */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-medium truncate',
                ing.checked ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {ing.displayName.charAt(0).toUpperCase() + ing.displayName.slice(1)}
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {ing.epicureKey.replace(/_/g, ' ')}
              </p>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              {!ing.confident && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {t('uncertain')}
                </span>
              )}
              {ing.alreadyInKitchen && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                  {t('inKitchen')}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border shrink-0 space-y-2">
        <Button
          onClick={handleConfirm}
          className="w-full rounded-full"
          disabled={checkedCount === 0}
        >
          {checkedCount > 0
            ? checkedCount !== 1 ? t('addIngredients', { count: checkedCount }) : t('addOneIngredient')
            : t('noIngredientsSelected')}
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full rounded-full text-muted-foreground"
        >
          {t('cancel')}
        </Button>
      </div>
    </motion.div>
  )
}
