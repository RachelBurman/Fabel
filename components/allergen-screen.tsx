'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ALLERGENS, DIET_PRESETS } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { ALL_TABS } from '@/lib/types'
import { Check, ArrowLeft, ShieldCheck, BarChart2, ChevronDown, Moon, Sun, PlayCircle, Compass, Layout } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CustomAllergenSearch } from '@/components/custom-allergen-search'

interface AllergenScreenProps {
  onDone: () => void
  onManageSafeFoods?: () => void
  onRestartTutorial?: () => void
  onOpenAuth?: () => void
}

export function AllergenScreen({ onDone, onManageSafeFoods, onRestartTutorial, onOpenAuth }: AllergenScreenProps) {
  const { preferences, toggleAllergen, setSafeFoodsMode, setShowMacros, togglePreset, setLactoseIntolerant, setLactoseMode, setDarkMode, setDiscoverSettings, setVisibleTabs, isLoadingProfile } = useFable()
  const { theme, setTheme } = useTheme()
  const { isSignedIn } = useUser()
  const [macrosAuthPrompt, setMacrosAuthPrompt] = useState(false)
  const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
  const isDark = theme === 'dark'

  const handleThemeToggle = () => {
    const newDark = !isDark
    setTheme(newDark ? 'dark' : 'light')
    setDarkMode(newDark)
  }

  const activePresetLabels = preferences.activePresets.map(id => DIET_PRESETS[id]?.label ?? id)
  const anyDietActive = preferences.activePresets.length > 0 || preferences.lactoseIntolerant

  const [isDietExpanded, setIsDietExpanded] = useState(false)

  // Expand the diet section once profile loads if any option is active
  useEffect(() => {
    if (!isLoadingProfile && anyDietActive) {
      setIsDietExpanded(true)
    }
  }, [isLoadingProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Header subtitle ────────────────────────────────────────────────────────
  const allergenCount = preferences.allergens.length + (preferences.customAllergens?.length ?? 0)

  const headerSubtitle = (() => {
    const parts: string[] = []
    if (activePresetLabels.length > 0) parts.push(activePresetLabels.join(', '))
    if (preferences.lactoseIntolerant) parts.push('Lactose intolerance')
    if (allergenCount > 0) parts.push(`${allergenCount} allergen${allergenCount > 1 ? 's' : ''}`)
    if (parts.length === 0) return 'No restrictions selected'
    return `${parts.join(' + ')} active`
  })()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={onDone} className="shrink-0 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Allergen Settings</h1>
              <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
            </div>
          </div>

          {/* ── Diet & Lifestyle — collapsible ── */}
          <div className="mb-6">
            <button
              onClick={() => setIsDietExpanded(v => !v)}
              className="flex items-center justify-between w-full text-left group mb-3"
            >
              <h2 className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Diet &amp; Lifestyle
              </h2>
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                {anyDietActive
                  ? [...activePresetLabels, ...(preferences.lactoseIntolerant ? ['Lactose'] : [])].join(', ') + ' active'
                  : 'None active'}
                <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', isDietExpanded && 'rotate-180')} />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isDietExpanded && (
                <motion.div
                  key="diet-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2">
                    {Object.values(DIET_PRESETS).map(preset => {
                      const isActive = preferences.activePresets.includes(preset.id)
                      return (
                        <div
                          key={preset.id}
                          className={cn(
                            'flex items-center justify-between gap-4 px-4 py-3 rounded-xl border transition-colors',
                            isActive ? 'bg-amber-500/5 border-amber-500/30' : 'bg-card border-border'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{preset.emoji}</span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{preset.label}</p>
                              <p className="text-xs text-muted-foreground">{preset.description}</p>
                            </div>
                          </div>
                          <button
                            role="switch"
                            aria-checked={isActive}
                            onClick={() => togglePreset(preset.id)}
                            className={cn(
                              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                              isActive ? 'bg-amber-500' : 'bg-secondary'
                            )}
                          >
                            <span className={cn(
                              'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                              isActive ? 'translate-x-5' : 'translate-x-0'
                            )} />
                          </button>
                        </div>
                      )
                    })}

                    {/* Lactose Intolerance */}
                    <div className={cn(
                      'rounded-xl border transition-colors',
                      preferences.lactoseIntolerant ? 'bg-amber-500/5 border-amber-500/30' : 'bg-card border-border'
                    )}>
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🥛</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">Lactose Intolerance</p>
                            <p className="text-xs text-muted-foreground">
                              {preferences.lactoseIntolerant && preferences.lactoseMode === 'include'
                                ? 'Dairy allowed — Lactaid reminder shown on recipes'
                                : preferences.lactoseIntolerant
                                ? 'Dairy excluded from all results'
                                : 'Shows a Lactaid reminder on dairy-containing recipes'}
                            </p>
                          </div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={preferences.lactoseIntolerant}
                          onClick={() => setLactoseIntolerant(!preferences.lactoseIntolerant)}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                            preferences.lactoseIntolerant ? 'bg-amber-500' : 'bg-secondary'
                          )}
                        >
                          <span className={cn(
                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                            preferences.lactoseIntolerant ? 'translate-x-5' : 'translate-x-0'
                          )} />
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {preferences.lactoseIntolerant && (
                          <motion.div
                            key="lactose-mode"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 pt-1 space-y-1 border-t border-amber-500/20">
                              {([
                                { value: 'include' as const, label: 'Include dairy with reminders', desc: "Dairy stays in recipes — you'll see a Lactaid reminder" },
                                { value: 'exclude' as const, label: 'Exclude dairy entirely', desc: 'Treats dairy like an allergen, filtered from all results' },
                              ]).map(({ value, label, desc }) => (
                                <button
                                  key={value}
                                  onClick={() => setLactoseMode(value)}
                                  className={cn(
                                    'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                                    preferences.lactoseMode === value ? 'bg-amber-500/10' : 'hover:bg-amber-500/5'
                                  )}
                                >
                                  <div className={cn(
                                    'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                                    preferences.lactoseMode === value ? 'border-amber-500 bg-amber-500' : 'border-muted-foreground'
                                  )}>
                                    {preferences.lactoseMode === value && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{label}</p>
                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* EU Big 14 grid */}
          <h2 className="text-sm font-medium text-muted-foreground mb-2">EU Big 14 Allergens</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-3">
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
                    'relative aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 transition-all duration-200',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </motion.div>
                  )}
                  <span className="text-3xl">{allergen.icon}</span>
                  <span className={cn('text-xs font-medium text-center leading-tight', isSelected ? 'text-primary' : 'text-foreground')}>
                    {allergen.name}
                  </span>
                </motion.button>
              )
            })}
          </div>

          <div className="mb-4">
            <CustomAllergenSearch />
          </div>

          {/* Safe Foods Mode */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" style={{ color: '#16a34a' }} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Safe Foods Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {preferences.safeIngredients.length === 0
                      ? 'No safe ingredients configured'
                      : `${preferences.safeIngredients.length} ingredients on your safe list`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSafeFoodsMode(!preferences.safeFoodsMode)}
                disabled={preferences.safeIngredients.length === 0}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-40',
                  safeFoodsActive ? 'bg-green-500' : 'bg-secondary'
                )}
                aria-label="Toggle Safe Foods Mode"
              >
                <span className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                  safeFoodsActive ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>

            {!safeFoodsActive && (
              <p className="text-xs text-muted-foreground mb-3">
                For MCAS, severe allergies, or highly restricted diets. Build a list of
                ingredients you can safely eat and we&apos;ll generate recipes exclusively from it.
              </p>
            )}

            <Button variant="outline" size="sm" onClick={onManageSafeFoods} className="w-full rounded-full gap-2">
              <ShieldCheck className="w-4 h-4" />
              {preferences.safeIngredients.length === 0 ? 'Set up safe foods list' : 'Manage safe foods list'}
            </Button>
          </div>

          {/* Nutritional information toggle */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Show nutritional information</p>
                  <p className="text-xs text-muted-foreground">Calories, protein, carbs and fat per serving</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isSignedIn) { setMacrosAuthPrompt(true); return }
                  setShowMacros(!preferences.showMacros)
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  preferences.showMacros ? 'bg-green-500' : 'bg-secondary'
                )}
                aria-label="Toggle nutritional information"
              >
                <span className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                  preferences.showMacros ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
            {macrosAuthPrompt && !isSignedIn ? (
              <p className="text-xs text-muted-foreground mt-2.5">
                <button
                  onClick={onOpenAuth}
                  className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                >
                  Sign in
                </button>
                {' '}to see nutritional information.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2.5">
                Calorie and macro information is hidden by default out of respect for users in eating disorder recovery.
              </p>
            )}
          </div>

          {/* Dark mode */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isDark ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-semibold text-foreground">Dark mode</p>
                  <p className="text-xs text-muted-foreground">{isDark ? 'Currently using dark theme' : 'Currently using light theme'}</p>
                </div>
              </div>
              <button
                onClick={handleThemeToggle}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  isDark ? 'bg-green-500' : 'bg-secondary'
                )}
                aria-label="Toggle dark mode"
              >
                <span className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                  isDark ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>
          </div>

          {/* Discover settings */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Compass className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Discover</p>
            </div>
            {([
              { key: 'showDiscover' as const,         label: 'Show Discover section',    desc: 'Trending insights above the generation flow' },
              { key: 'showTrendingForYou' as const,   label: 'Show Trending for you',    desc: 'Recipe types popular with your allergen profile' },
              { key: 'showTrendingGlobally' as const, label: 'Show Trending globally',   desc: 'Most liked ingredients across all users' },
              { key: 'showMostLoved' as const,        label: 'Show Most loved ingredients', desc: 'All-time top ingredients for your profile' },
              { key: 'showTrendingPairings' as const, label: 'Show Trending pairings',   desc: 'Popular drink and cuisine combinations' },
            ]).map(({ key, label, desc }) => {
              const isOn = preferences.discoverSettings[key]
              return (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={isOn}
                    onClick={() => setDiscoverSettings({ ...preferences.discoverSettings, [key]: !isOn })}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      isOn ? 'bg-green-500' : 'bg-secondary'
                    )}
                  >
                    <span className={cn(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                      isOn ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Navigation settings */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-1">
              <Layout className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Navigation</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">At least 2 tabs must remain visible.</p>
            {ALL_TABS.map((tabId) => {
              const labelMap: Record<string, string> = {
                kitchen: 'Kitchen', recipe: 'Recipe', discover: 'Discover', substitutes: 'Substitutes', history: 'History', saved: 'Saved',
              }
              const isVisible = preferences.visibleTabs.includes(tabId)
              const wouldViolateMin = isVisible && preferences.visibleTabs.length <= 2
              return (
                <div key={tabId} className="flex items-center justify-between py-2">
                  <p className="text-sm text-foreground">{labelMap[tabId]}</p>
                  <button
                    role="switch"
                    aria-checked={isVisible}
                    disabled={wouldViolateMin}
                    onClick={() => {
                      if (wouldViolateMin) return
                      const next = isVisible
                        ? preferences.visibleTabs.filter(t => t !== tabId)
                        : [...preferences.visibleTabs, tabId]
                      setVisibleTabs(next)
                    }}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      isVisible ? 'bg-green-500' : 'bg-secondary',
                      wouldViolateMin && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <span className={cn(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                      isVisible ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Tutorial */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Tutorial</p>
                  <p className="text-xs text-muted-foreground">Revisit the intro slideshow</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRestartTutorial}
                className="rounded-full text-xs"
              >
                Restart tutorial
              </Button>
            </div>
          </div>

          {/* Done */}
          <div className="pt-4 border-t border-border mt-auto">
            <Button size="lg" onClick={onDone} className="w-full rounded-full py-6">
              Done
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}
