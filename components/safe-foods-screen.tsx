'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFable } from '@/lib/fable-context'
import { Plus, X, Search, ShieldCheck, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { displayName } from '@/components/ingredients-screen'
import { useIngredientSearch } from '@/lib/hooks/use-ingredient-search'
import { useTranslations } from 'next-intl'

interface SafeFoodsScreenProps {
  onDone: () => void
  doneLabel?: string
  /** When true, renders a full-page layout with a back button in the header */
  fullPage?: boolean
  onBack?: () => void
}

export function SafeFoodsScreen({
  onDone,
  doneLabel,
  fullPage = false,
  onBack,
}: SafeFoodsScreenProps) {
  const { preferences, addSafeIngredient, removeSafeIngredient } = useFable()
  const t = useTranslations('safeFoods')
  const tSettings = useTranslations('settings')

  const [inputValue, setInputValue] = useState('')
  const [debouncedInput, setDebouncedInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
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

  const handleAdd = useCallback((ingredient: string) => {
    addSafeIngredient(ingredient)
    setInputValue('')
    setShowDropdown(false)
  }, [addSafeIngredient])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleAdd(
        dropdownItems.length > 0
          ? dropdownItems[0]
          : inputValue.trim().toLowerCase().replace(/\s+/g, '_')
      )
    }
    if (e.key === 'Escape') setShowDropdown(false)
  }

  const dropdownItems = searchResults.filter(r => !preferences.safeIngredients.includes(r))

  const count = preferences.safeIngredients.length

  const inner = (
    <div className={cn('flex flex-col', fullPage ? 'flex-1' : '')}>
      {/* Header */}
      {fullPage && (
        <div className="flex items-center gap-4 mb-8">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('pageTitle')}</h1>
            <p className="text-sm text-muted-foreground">
              {count === 0 ? t('noIngredientsYet') : count !== 1 ? t('ingredientCountPlural', { count }) : t('ingredientCount', { count })}
            </p>
          </div>
        </div>
      )}

      {!fullPage && (
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ backgroundColor: 'rgba(34,197,94,0.12)' }}>
            <ShieldCheck className="w-8 h-8" style={{ color: '#16a34a' }} />
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
            {t('yourSafeIngredients')}
          </h2>
          <p className="text-muted-foreground text-pretty max-w-md mx-auto">
            {t('addDesc')}
          </p>
        </div>
      )}

      {/* Search input */}
      <div className="relative mb-6">
        <div ref={inputWrapperRef} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value)
              setShowDropdown(e.target.value.length > 0)
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.length > 0) setShowDropdown(true)
              recomputeCoords()
            }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="pl-12 pr-4 py-6 text-base rounded-xl bg-card border-border"
          />
        </div>
      </div>

      {/* Safe ingredient chips */}
      {count > 0 ? (
        <div className="flex-1 mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {t('ingredientsHeading', { count })}
          </h3>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {preferences.safeIngredients.map(ingredient => (
                <motion.button
                  key={ingredient}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  layout
                  onClick={() => removeSafeIngredient(ingredient)}
                  className="group flex items-center gap-2 px-4 py-2 rounded-full border transition-colors"
                  style={{
                    backgroundColor: 'rgba(34,197,94,0.10)',
                    borderColor: 'rgba(34,197,94,0.25)',
                    color: '#15803d',
                  }}
                >
                  <span className="text-sm">{displayName(ingredient)}</span>
                  <X className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center py-8">
          <div>
            <p className="text-muted-foreground">{t('noIngredientsEmpty')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('searchToStart')}
            </p>
          </div>
        </div>
      )}

      {/* Done button */}
      <div className="pt-4 border-t border-border mt-auto">
        <Button size="lg" onClick={onDone} className="w-full rounded-full py-6 gap-2">
          <ShieldCheck className="w-5 h-5" />
          {count > 0 ? t('doneWithCount', { count }) : (doneLabel ?? tSettings('done'))}
        </Button>
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
                  onClick={() => handleAdd(name)}
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

  if (fullPage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-6 py-8 md:py-12">
          <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100dvh - 8rem)' }}>
            {inner}
          </div>
        </div>
      </div>
    )
  }

  return inner
}
