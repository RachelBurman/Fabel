'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFable } from '@/lib/fable-context'
import { Plus, X, Search, ChefHat, Sparkles, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface IngredientsScreenProps {
  onShowPairings: () => void
  onGenerateRecipe: () => void
}

// Curated popular ingredients from the Epicure dataset shown as quick-add chips
const POPULAR_INGREDIENTS = [
  'chicken', 'garlic', 'onion', 'tomato', 'lemon',
  'olive_oil', 'ginger', 'rice', 'egg', 'butter',
  'salmon', 'pasta',
]

function displayName(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function IngredientsScreen({ onShowPairings, onGenerateRecipe }: IngredientsScreenProps) {
  const { preferences, addIngredient, removeIngredient } = useFable()
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchResults, setSearchResults] = useState<string[]>([])

  // Debounced search against the Epicure ingredient list
  useEffect(() => {
    const q = inputValue.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ingredients?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data: { results: string[] } = await res.json()
          setSearchResults(data.results)
        }
      } catch {
        // ignore autocomplete errors silently
      }
    }, 150)
    return () => clearTimeout(id)
  }, [inputValue])

  const handleAddIngredient = useCallback((ingredient: string) => {
    addIngredient(ingredient)
    setInputValue('')
    setSearchResults([])
    setShowSuggestions(false)
  }, [addIngredient])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      // Prefer the top search result; fall back to the typed value normalised
      handleAddIngredient(
        searchResults.length > 0
          ? searchResults[0]
          : inputValue.trim().toLowerCase().replace(/\s+/g, '_')
      )
    }
  }

  // Exclude already-selected ingredients from the dropdown
  const dropdownItems = searchResults.filter(
    (r) => !preferences.ingredients.includes(r)
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2 text-balance">
              What&apos;s in your kitchen?
            </h1>
            <p className="text-muted-foreground text-pretty">
              Add the ingredients you have and we&apos;ll find matching recipes
            </p>
          </div>

          {/* Search input */}
          <div className="relative mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search 1,790 ingredients…"
                value={inputValue}
                onChange={e => {
                  setInputValue(e.target.value)
                  setShowSuggestions(e.target.value.length > 0)
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setShowSuggestions(inputValue.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-12 pr-4 py-6 text-base rounded-xl bg-card border-border"
              />
            </div>

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {showSuggestions && dropdownItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10"
                >
                  {dropdownItems.map((name, index) => (
                    <button
                      key={name}
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
            </AnimatePresence>
          </div>

          {/* Selected ingredients / empty state */}
          <div className="mb-8 flex-1">
            {preferences.ingredients.length > 0 ? (
              <>
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
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No ingredients added yet</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {POPULAR_INGREDIENTS.map(name => (
                    <button
                      key={name}
                      onClick={() => handleAddIngredient(name)}
                      className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors"
                    >
                      + {displayName(name)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border space-y-3">
            <Button
              size="lg"
              onClick={onGenerateRecipe}
              disabled={preferences.ingredients.length === 0}
              className="w-full rounded-full gap-2 py-6"
            >
              <Sparkles className="w-5 h-5" />
              Generate Recipe
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onShowPairings}
              disabled={preferences.ingredients.length === 0}
              className="w-full rounded-full gap-2"
            >
              <Layers className="w-5 h-5" />
              Show Pairings
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              We&apos;ll find recipes that match your ingredients and avoid your allergens
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
