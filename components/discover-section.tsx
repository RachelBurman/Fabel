'use client'

import { TrendingUp, Globe, Heart, Wine, Sparkles, ChefHat, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useFable } from '@/lib/fable-context'
import { type IngredientInsightsRecord, type RecipeSuggestion } from '@/lib/types'
import { useInsights } from '@/lib/hooks/use-insights'
import { useTranslations } from 'next-intl'

const ALLERGEN_LABELS: Record<string, string> = {
  milk: 'Milk', eggs: 'Eggs', gluten: 'Gluten', peanuts: 'Peanuts',
  tree_nuts: 'Tree Nuts', fish: 'Fish', crustaceans: 'Crustaceans',
  molluscs: 'Molluscs', soy: 'Soy', sesame: 'Sesame', mustard: 'Mustard',
  celery: 'Celery', sulphites: 'Sulphites', lupin: 'Lupin',
}

function formatCustomAllergen(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const SIGNAL_KEY_MAP: Record<string, string> = {
  'Too complex':          'signals.tooComplex',
  'Too simple':           'signals.tooSimple',
  'Wrong cuisine vibe':   'signals.wrongCuisine',
  'Great cuisine choice': 'signals.greatCuisine',
  'Too many ingredients': 'signals.tooManyIngredients',
  'Quick to make':        'signals.quickToMake',
  'Took too long':        'signals.tookTooLong',
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
  const { preferences, userId, isSignedIn } = useFable()
  const { discoverSettings } = preferences
  const t = useTranslations('discover')

  const insightsQuery = useInsights(userId, isSignedIn)
  const data = insightsQuery.data as InsightsData | undefined
  const isLoading = insightsQuery.isLoading

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-background">
      <div className="px-6 py-6 max-w-2xl mx-auto space-y-8">

        {/* Your taste profile */}
        {data?.tasteProfile && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-foreground">{t('tasteProfile')}</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {data.tasteProfile.preferred.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground w-28 pt-0.5 shrink-0">{t('youLove')}</span>
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
                  <span className="text-xs text-muted-foreground w-28 pt-0.5 shrink-0">{t('youAvoid')}</span>
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
                  <div className="w-28 shrink-0 pt-0.5 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{t('flavourTerritory')}</span>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-muted-foreground/50 cursor-default shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-48 text-xs">
                            {t('flavourTerritoryTooltip')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 leading-tight">{t('flavourTerritorySubtitle')}</span>
                  </div>
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
                  <span className="text-xs text-muted-foreground w-28 pt-0.5 shrink-0">{t('yourPreferences')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tasteProfile.formatSignals.map((signal, i) => {
                      const key = SIGNAL_KEY_MAP[signal]
                      if (!key) return null
                      return (
                        <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-foreground">
                          {t(key as Parameters<typeof t>[0])}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1">{t('basedOn', { count: data.tasteProfile.signalCount })}</p>
            </div>
          </div>
        )}

        {/* Suggested for you — pre-computed recipe directions from taste-profile-writer Lambda */}
        {data?.tasteProfile?.recipeSuggestions && data.tasteProfile.recipeSuggestions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">{t('suggestedForYou')}</h2>
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
              <h2 className="text-sm font-semibold text-foreground">{t('trendingForYou')}</h2>
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
              <p className="text-sm text-muted-foreground">{t('noDataYet')}</p>
            )}
          </div>
        )}

        {/* Trending globally */}
        {discoverSettings.showTrendingGlobally && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t('trendingGlobally')}</h2>
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
              <p className="text-sm text-muted-foreground">{t('noGlobalTrends')}</p>
            )}
          </div>
        )}

        {/* Most loved ingredients */}
        {discoverSettings.showMostLoved && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-foreground">{t('mostLoved')}</h2>
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
              <p className="text-sm text-muted-foreground">{t('noAllTimeData')}</p>
            )}
          </div>
        )}

        {/* Trending pairings */}
        {discoverSettings.showTrendingPairings && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wine className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-foreground">{t('trendingPairings')}</h2>
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
              <p className="text-sm text-muted-foreground">{t('noPairingsData')}</p>
            )}
          </div>
        )}

        {!discoverSettings.showTrendingForYou
          && !discoverSettings.showTrendingGlobally
          && !discoverSettings.showMostLoved
          && !discoverSettings.showTrendingPairings && (
          <p className="text-sm text-muted-foreground">{t('allHidden')}</p>
        )}

      </div>
    </div>
  )
}
