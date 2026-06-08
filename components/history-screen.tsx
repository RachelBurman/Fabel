'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { type HistoryEntry } from '@/lib/types'
import { Clock, Users, History, Share2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecipeGradient } from '@/components/recipe-gradient'
import { shareRecipe } from '@/lib/share-recipe'

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
  onView: (entry: HistoryEntry) => void
}

function HistoryCard({ entry, index, onView }: HistoryCardProps) {
  const { recipe, timestamp } = entry
  const [sharing, setSharing] = useState(false)

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (sharing) return
    setSharing(true)
    try {
      await shareRecipe(entry.id, recipe)
    } finally {
      setSharing(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      onClick={() => onView(entry)}
      className="w-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer"
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
        <div className="flex items-center justify-between">
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
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            aria-label="Share recipe"
          >
            {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

interface HistoryScreenProps {
  history: HistoryEntry[]
  onViewRecipe: (entry: HistoryEntry) => void
  onGenerateNew: () => void
  onBack?: () => void
}

export function HistoryScreen({ history, onViewRecipe, onGenerateNew, onBack }: HistoryScreenProps) {
  if (history.length === 0) {
    return (
      <div className="bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] px-6 text-center"
        >
          <div className="text-5xl mb-6">📖</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No recipes yet</h2>
          <p className="text-muted-foreground max-w-xs mx-auto mb-8">
            Generate your first recipe to see your history here.
          </p>
          <Button onClick={onGenerateNew} className="rounded-full gap-2">
            Generate a recipe <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack} className="back-btn shrink-0 rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Clock className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Recipe History</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {`${history.length} recipe${history.length > 1 ? 's' : ''} in your history`}
            </p>
          </div>

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

        </div>
      </div>
    </div>
  )
}
