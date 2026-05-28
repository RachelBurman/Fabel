'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ALLERGENS } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Check, X, Search, ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { displayName } from '@/components/ingredients-screen'

interface AllergenScreenProps {
  onDone: () => void
}

export function AllergenScreen({ onDone }: AllergenScreenProps) {
  const { preferences, toggleAllergen, toggleCustomAllergen } = useFable()

  // Custom allergen ingredient search
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

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
    const q = query.trim()
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
  }, [query, recomputeCoords])

  useEffect(() => {
    if (showDropdown) recomputeCoords()
  }, [showDropdown, recomputeCoords])

  const handleSelectCustom = useCallback((ingredient: string) => {
    if (!preferences.customAllergens.includes(ingredient)) {
      toggleCustomAllergen(ingredient)
    }
    setQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }, [preferences.customAllergens, toggleCustomAllergen])

  // Dropdown excludes already-selected custom allergens
  const dropdownItems = searchResults.filter(
    r => !preferences.customAllergens.includes(r)
  )

  const totalCount = preferences.allergens.length + preferences.customAllergens.length

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

          {/* EU Big 14 grid */}
          <h2 className="text-sm font-medium text-muted-foreground mb-3">EU Big 14 Allergens</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
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
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                  <span className="text-2xl">{allergen.icon}</span>
                  <span className={cn('text-sm font-medium text-center', isSelected ? 'text-primary' : 'text-foreground')}>
                    {allergen.name}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {/* Custom ingredient allergen search */}
          <div className="border-t border-border pt-6 mb-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-1">
              Have a specific allergy? Search all ingredients
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Add individual ingredients you need to avoid
            </p>
            <div ref={inputWrapperRef} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="e.g. garlic, sesame oil, tofu…"
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setShowDropdown(e.target.value.length > 0)
                }}
                onFocus={() => {
                  if (query.length > 0) setShowDropdown(true)
                  recomputeCoords()
                }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && dropdownItems.length > 0) handleSelectCustom(dropdownItems[0])
                  if (e.key === 'Escape') setShowDropdown(false)
                }}
                className="pl-10 pr-4 py-5 rounded-xl bg-card border-border"
              />
            </div>

            {/* Custom allergen tags */}
            {preferences.customAllergens.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {preferences.customAllergens.map(ingredient => (
                  <button
                    key={ingredient}
                    onClick={() => toggleCustomAllergen(ingredient)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-full text-sm border border-destructive/20 hover:bg-destructive/20 transition-colors"
                  >
                    {displayName(ingredient)}
                    <X className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Done button */}
          <div className="pt-4 border-t border-border mt-auto">
            <Button size="lg" onClick={onDone} className="w-full rounded-full py-6">
              Done
            </Button>
          </div>

        </div>
      </div>

      {/* Portal dropdown */}
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
                  onMouseDown={e => { e.preventDefault(); handleSelectCustom(name) }}
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
