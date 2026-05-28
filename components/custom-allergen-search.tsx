'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFable } from '@/lib/fable-context'
import { Search, X, Plus, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { displayName } from '@/components/ingredients-screen'

export function CustomAllergenSearch() {
  const { preferences, toggleCustomAllergen } = useFable()

  // Auto-expand if the user already has custom allergens selected
  const [isExpanded, setIsExpanded] = useState(() => preferences.customAllergens.length > 0)
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

  const handleSelect = useCallback((ingredient: string) => {
    if (!preferences.customAllergens.includes(ingredient)) {
      toggleCustomAllergen(ingredient)
    }
    setQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }, [preferences.customAllergens, toggleCustomAllergen])

  const dropdownItems = searchResults.filter(r => !preferences.customAllergens.includes(r))

  return (
    <div className="border-t border-border pt-4">

      {/* Toggle row */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="flex items-center justify-between w-full text-left group"
      >
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          Have a specific allergy?
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-primary">
          {isExpanded ? 'Close' : 'Search ingredients'}
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
          />
        </span>
      </button>

      {/* Collapsible search input */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="search"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div ref={inputWrapperRef} className="relative mt-3">
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
                  if (e.key === 'Enter' && dropdownItems.length > 0) handleSelect(dropdownItems[0])
                  if (e.key === 'Escape') setShowDropdown(false)
                }}
                className="pl-10 pr-4 py-5 rounded-xl bg-card border-border"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected custom allergen tags — always visible */}
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
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelect(name)}
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
