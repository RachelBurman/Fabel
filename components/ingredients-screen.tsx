'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFable } from '@/lib/fable-context'
import { Plus, X, Search, ChefHat, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface IngredientsScreenProps {
  onFindRecipes: () => void
}

const SUGGESTED_INGREDIENTS = [
  'chicken', 'rice', 'tomatoes', 'garlic', 'onions',
  'olive oil', 'lemon', 'herbs', 'potatoes', 'carrots',
  'broccoli', 'salmon', 'pasta', 'eggs', 'cheese',
]

export function IngredientsScreen({ onFindRecipes }: IngredientsScreenProps) {
  const { preferences, addIngredient, removeIngredient } = useFable()
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleAddIngredient = useCallback((ingredient: string) => {
    addIngredient(ingredient)
    setInputValue('')
    setShowSuggestions(false)
  }, [addIngredient])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleAddIngredient(inputValue.trim())
    }
  }

  const filteredSuggestions = SUGGESTED_INGREDIENTS.filter(
    ing =>
      ing.toLowerCase().includes(inputValue.toLowerCase()) &&
      !preferences.ingredients.includes(ing.toLowerCase())
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

          {/* Input Area */}
          <div className="relative mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Type an ingredient..."
                value={inputValue}
                onChange={e => {
                  setInputValue(e.target.value)
                  setShowSuggestions(e.target.value.length > 0)
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setShowSuggestions(inputValue.length > 0 || true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-12 pr-4 py-6 text-base rounded-xl bg-card border-border"
              />
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10"
                >
                  {filteredSuggestions.slice(0, 6).map((suggestion, index) => (
                    <button
                      key={suggestion}
                      onClick={() => handleAddIngredient(suggestion)}
                      className={cn(
                        'w-full text-left px-4 py-3 text-foreground hover:bg-secondary transition-colors',
                        index !== filteredSuggestions.slice(0, 6).length - 1 && 'border-b border-border'
                      )}
                    >
                      <Plus className="w-4 h-4 inline-block mr-2 text-muted-foreground" />
                      {suggestion}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Selected Ingredients */}
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
                        <span className="capitalize">{ingredient}</span>
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
                  {SUGGESTED_INGREDIENTS.slice(0, 8).map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => handleAddIngredient(suggestion)}
                      className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Find Recipes Button */}
          <div className="pt-4 border-t border-border">
            <Button
              size="lg"
              onClick={onFindRecipes}
              disabled={preferences.ingredients.length === 0}
              className="w-full rounded-full gap-2 py-6"
            >
              <Sparkles className="w-5 h-5" />
              Find Safe Recipes
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-3">
              We&apos;ll find recipes that match your ingredients and avoid your allergens
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
