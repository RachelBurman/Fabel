'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, TrendingUp, Globe, Heart, Wine, Compass } from 'lucide-react'
import { useFable } from '@/lib/fable-context'
import { cn } from '@/lib/utils'
import { type IngredientInsightsRecord } from '@/lib/types'

interface InsightsData {
  profileKey: string
  weekStr: string
  profileWeek: IngredientInsightsRecord | null
  profileAllTime: IngredientInsightsRecord | null
  globalWeek: IngredientInsightsRecord | null
}

interface DiscoverSectionProps {
  onSelectCuisine?: (cuisine: string) => void
  onSelectOccasion?: (occasion: string) => void
}

export function DiscoverSection({ onSelectCuisine, onSelectOccasion }: DiscoverSectionProps) {
  const { preferences } = useFable()
  const { discoverSettings } = preferences

  const [isExpanded, setIsExpanded] = useState(true)
  const [data, setData] = useState<InsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!discoverSettings.showDiscover) return
    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    if (!uid) return

    setIsLoading(true)
    fetch(`/api/insights?userId=${uid}`)
      .then(res => res.ok ? res.json() : null)
      .then((d: InsightsData | null) => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [discoverSettings.showDiscover])

  if (!discoverSettings.showDiscover) return null

  const hasAnyContent = discoverSettings.showTrendingForYou
    || discoverSettings.showTrendingGlobally
    || discoverSettings.showMostLoved
    || discoverSettings.showTrendingPairings

  if (!hasAnyContent) return null

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Discover</span>
          {isLoading && (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 text-muted-foreground transition-transform duration-200',
          isExpanded && 'rotate-180'
        )} />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="discover-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">

              {/* Trending for you */}
              {discoverSettings.showTrendingForYou && data?.profileWeek?.trendingRecipeTypes && data.profileWeek.trendingRecipeTypes.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trending for you</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.profileWeek.trendingRecipeTypes.slice(0, 3).map((rt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onSelectCuisine?.(rt.cuisine)
                          onSelectOccasion?.(rt.occasion)
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {rt.cuisine} · {rt.occasion.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending globally */}
              {discoverSettings.showTrendingGlobally && data?.globalWeek?.trendingIngredients && data.globalWeek.trendingIngredients.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trending globally</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.globalWeek.trendingIngredients.slice(0, 5).map((ing, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-foreground"
                      >
                        {ing.key}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Most loved ingredients */}
              {discoverSettings.showMostLoved && data?.profileAllTime?.trendingIngredients && data.profileAllTime.trendingIngredients.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Most loved ingredients</span>
                  </div>
                  <div className="space-y-1.5">
                    {data.profileAllTime.trendingIngredients.slice(0, 6).map((ing, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-foreground w-32 truncate">{ing.key}</span>
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-400 rounded-full"
                            style={{ width: `${Math.round(ing.score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(ing.score * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending pairings */}
              {discoverSettings.showTrendingPairings && data?.profileWeek?.trendingPairings && data.profileWeek.trendingPairings.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wine className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trending pairings</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.profileWeek.trendingPairings.slice(0, 3).map((p, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400"
                      >
                        {p.beverage} with {p.recipeType}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state when data isn't loaded yet */}
              {!isLoading && !data && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Insights load after your first recipe feedback.
                </p>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
