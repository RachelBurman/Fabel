'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Globe, Heart, Wine } from 'lucide-react'
import { useFable } from '@/lib/fable-context'
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

  const [data, setData] = useState<InsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('fable_user_id') : null
    if (!uid) return

    setIsLoading(true)
    fetch(`/api/insights?userId=${uid}`)
      .then(res => res.ok ? res.json() : null)
      .then((d: InsightsData | null) => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-background">
      <div className="px-6 py-6 max-w-2xl mx-auto space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Discover</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading trends…' : data ? `Trending this week · ${data.profileKey}` : 'Trends load after your first recipe feedback.'}
          </p>
        </div>

        {/* Trending for you */}
        {discoverSettings.showTrendingForYou && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Trending for you</h2>
            </div>
            {data?.profileWeek?.trendingRecipeTypes && data.profileWeek.trendingRecipeTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.profileWeek.trendingRecipeTypes.slice(0, 3).map((rt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onSelectCuisine?.(rt.cuisine)
                      onSelectOccasion?.(rt.occasion)
                    }}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {rt.cuisine} · {rt.occasion.replace(/-/g, ' ')}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet — like some recipes to see trends.</p>
            )}
          </div>
        )}

        {/* Trending globally */}
        {discoverSettings.showTrendingGlobally && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Trending globally</h2>
            </div>
            {data?.globalWeek?.trendingIngredients && data.globalWeek.trendingIngredients.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.globalWeek.trendingIngredients.slice(0, 5).map((ing, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-secondary text-foreground"
                  >
                    {ing.key}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No global trends yet.</p>
            )}
          </div>
        )}

        {/* Most loved ingredients */}
        {discoverSettings.showMostLoved && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-foreground">Most loved ingredients</h2>
            </div>
            {data?.profileAllTime?.trendingIngredients && data.profileAllTime.trendingIngredients.length > 0 ? (
              <div className="space-y-2.5">
                {data.profileAllTime.trendingIngredients.slice(0, 6).map((ing, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-foreground w-36 truncate">{ing.key}</span>
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-400 rounded-full transition-all"
                        style={{ width: `${Math.round(ing.score * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-9 text-right">{Math.round(ing.score * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No all-time data yet.</p>
            )}
          </div>
        )}

        {/* Trending pairings */}
        {discoverSettings.showTrendingPairings && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wine className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-foreground">Trending pairings</h2>
            </div>
            {data?.profileWeek?.trendingPairings && data.profileWeek.trendingPairings.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.profileWeek.trendingPairings.slice(0, 3).map((p, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  >
                    {p.beverage} with {p.recipeType}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pairing trends yet.</p>
            )}
          </div>
        )}

        {!discoverSettings.showTrendingForYou
          && !discoverSettings.showTrendingGlobally
          && !discoverSettings.showMostLoved
          && !discoverSettings.showTrendingPairings && (
          <p className="text-sm text-muted-foreground">All sub-sections are hidden. Turn them on in Settings.</p>
        )}

      </div>
    </div>
  )
}
