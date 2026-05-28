'use client'

import { motion } from 'framer-motion'
import { type HistoryEntry, type GeneratedRecipe } from '@/lib/types'
import { Clock, Users, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecipeGradient } from '@/components/recipe-gradient'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface HistoryCardProps {
  entry: HistoryEntry
  index: number
  onView: (recipe: GeneratedRecipe) => void
}

function HistoryCard({ entry, index, onView }: HistoryCardProps) {
  const { recipe, timestamp } = entry
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      onClick={() => onView(recipe)}
      className="w-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
    >
      {/* Gradient thumbnail */}
      <RecipeGradient title={recipe.title} className="w-full h-32">
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <h3 className="text-white text-sm font-semibold leading-snug text-balance line-clamp-2 drop-shadow">
            {recipe.title}
          </h3>
        </div>
        <span className="absolute top-3 right-3 text-xs text-white/70 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
          {relativeTime(timestamp)}
        </span>
      </RecipeGradient>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {recipe.description}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{recipe.cookTime}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>{recipe.servings} servings</span>
          </div>
        </div>
      </div>
    </motion.button>
  )
}

interface HistoryScreenProps {
  history: HistoryEntry[]
  onViewRecipe: (recipe: GeneratedRecipe) => void
  onGenerateNew: () => void
}

export function HistoryScreen({ history, onViewRecipe, onGenerateNew }: HistoryScreenProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <Clock className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Recipe History</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {history.length === 0
                ? 'No recipes generated yet this session'
                : `${history.length} recipe${history.length > 1 ? 's' : ''} generated this session`}
            </p>
          </div>

          {history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <HistoryCard
                  key={entry.id}
                  entry={entry}
                  index={index}
                  onView={onViewRecipe}
                />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
                <History className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No history yet</h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Generated recipes will appear here so you can revisit them anytime during this session.
              </p>
              <Button onClick={onGenerateNew} className="rounded-full">
                Generate a Recipe
              </Button>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}
