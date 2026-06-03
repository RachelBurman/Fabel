'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Globe, Heart, Wine, Sparkles, ChefHat } from 'lucide-react'
import { useFable } from '@/lib/fable-context'
import { type IngredientInsightsRecord, type RecipeSuggestion } from '@/lib/types'

const ALLERGEN_LABELS: Record<string, string> = {
  milk: 'Milk', eggs: 'Eggs', gluten: 'Gluten', peanuts: 'Peanuts',
  tree_nuts: 'Tree Nuts', fish: 'Fish', crustaceans: 'Crustaceans',
  molluscs: 'Molluscs', soy: 'Soy', sesame: 'Sesame', mustard: 'Mustard',
  celery: 'Celery', sulphites: 'Sulphites', lupin: 'Lupin',
}

function formatCustomAllergen(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const SIGNAL_DISPLAY_LABELS: Record<string, string> = {
  'Too complex':          'simpler recipes',
  'Too simple':           'more ambitious recipes',
  'Wrong cuisine vibe':   'different cuisines',
  'Great cuisine choice': 'similar cuisines',
  'Too many ingredients': 'fewer ingredients',
  'Quick to make':        'quick to make',
  'Took too long':        'shorter cook time',
}

interface TasteProfile {
  preferred: string[]
  avoided: string[]
  flavourTerritory: string[]
  signalCount: number
  formatSignals: string[]
  recipeSuggestions?: RecipeSuggestion[]
}

interface TrendingForYouItem {
  cuisine: string
  occasion: string
  seedIngredients: string[]
}

interface InsightsData {
  profileKey: string
  weekStr: string
  allergens: string[]
  customAllergens: string[]
  profileWeek: IngredientInsightsRecord | null
  profileAllTime: IngredientInsightsRecord | null
  globalWeek: IngredientInsightsRecord | null
  tasteProfile: TasteProfile | null
  trendingForYou: TrendingForYouItem[]
}

interface DiscoverSectionProps {
  onSelectCuisine?: (cuisine: string) => void
  onSelectOccasion?: (occasion: string) => void
  onSeedIngredients?: (ingredients: string[]) => void
  onSelectSuggestion?: (suggestion: RecipeSuggestion) => void
}

export function DiscoverSection({ onSelectCuisine, onSelectOccasion, onSeedIngredients, onSelectSuggestion }: DiscoverSectionProps) {
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
            {isLoading ? 'Loading trends…' : data ? (
              data.allergens.length === 0 && data.customAllergens.length === 0
                ? 'Trending this week · global'
                : <>
                    Trending this week · safe for you
                    <span className="block text-xs mt-0.5">
                      Excluding {[
                        ...data.allergens.map(a => ALLERGEN_LABELS[a] ?? formatCustomAllergen(a)),
                        ...data.customAllergens.map(formatCustomAllergen),
                      ].join(', ')}
                    </span>
                  </>
            ) : 'Trends load after your first recipe feedback.'}
          </p>
        </div>

        {/* Your taste profile */}
        {data?.tasteProfile && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground">Your taste profile</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {data.tasteProfile.preferred.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground w-28 pt-0.5 shrink-0">You love</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tasteProfile.preferred.map((ing, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.tasteProfile.avoided.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground w-28 pt-0.5 shrink-0">You avoid</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tasteProfile.avoided.map((ing, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-foreground">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.tasteProfile.flavourTerritory.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground w-28 pt-0.5 shrink-0">Flavour territory</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tasteProfile.flavourTerritory.map((ing, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.tasteProfile.formatSignals?.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground w-28 pt-0.5 shrink-0">Your preferences</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tasteProfile.formatSignals.map((signal, i) => {
                      const label = SIGNAL_DISPLAY_LABELS[signal]
                      if (!label) return null
                      return (
                        <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-foreground">
                          {label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1">Based on your last {data.tasteProfile.signalCount} recipes</p>
            </div>
          </div>
        )}

        {/* Suggested for you — pre-computed recipe directions from taste-profile-writer Lambda */}
        {data?.tasteProfile?.recipeSuggestions && data.tasteProfile.recipeSuggestions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Suggested for you</h2>
            </div>
            <div className="space-y-2.5">
              {data.tasteProfile.recipeSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSelectSuggestion?.(s)}
                  className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                >
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                    {s.direction}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {s.reasoning}
                  </p>
                  {s.noveltyNote && (
                    <p className="text-xs text-muted-foreground/70 mt-1.5">··· {s.noveltyNote}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trending for you */}
        {discoverSettings.showTrendingForYou && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Trending for you</h2>
            </div>
            {data?.trendingForYou && data.trendingForYou.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.trendingForYou.map((rt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onSelectCuisine?.(rt.cuisine)
                      onSelectOccasion?.(rt.occasion)
                      if (rt.seedIngredients.length > 0) {
                        onSeedIngredients?.(rt.seedIngredients)
                      }
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
