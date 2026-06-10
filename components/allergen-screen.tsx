'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ALLERGENS, DIET_PRESETS, ALL_TABS, type SpiceTolerance, type Adventurousness } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Check, ArrowLeft, ShieldCheck, BarChart2, ChevronDown, Moon, Sun, Monitor, PlayCircle, Compass, Layout, UtensilsCrossed, Loader2, Trash2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSession, signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CustomAllergenSearch } from '@/components/custom-allergen-search'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface AllergenScreenProps {
  onDone: () => void
  onManageSafeFoods?: () => void
  onRestartTutorial?: () => void
  onOpenAuth?: () => void
}

export function AllergenScreen({ onDone, onManageSafeFoods, onRestartTutorial, onOpenAuth }: AllergenScreenProps) {
  const { preferences, toggleAllergen, setSafeFoodsMode, setShowMacros, togglePreset, setLactoseIntolerant, setLactoseMode, setAlcoholMode, setLowHistamine, setColorMode, setDiscoverSettings, setVisibleTabs, setSpiceTolerance, setAdventurousness, isLoadingProfile } = useFable()
  const { setTheme } = useTheme()
  const { data: session } = useSession()
  const isSignedIn = !!session?.user
  const [macrosAuthPrompt, setMacrosAuthPrompt] = useState(false)
  const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
  const colorMode = preferences.colorMode
  const t = useTranslations('settings')
  const tPresets = useTranslations('presets')
  const tSpice = useTranslations('spiceLevels')
  const tAdventurous = useTranslations('adventurous')
  const tCommon = useTranslations('common')

  const handleColorModeChange = (mode: 'light' | 'dark' | 'system') => {
    setTheme(mode)
    setColorMode(mode)
  }

  const activePresetLabels = preferences.activePresets.map(id => DIET_PRESETS[id]?.label ?? id)
  const anyDietActive = preferences.activePresets.length > 0 || preferences.lactoseIntolerant || preferences.alcoholMode !== 'none' || preferences.lowHistamine

  const [isDietExpanded, setIsDietExpanded] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Expand the diet section once profile loads if any option is active
  useEffect(() => {
    if (!isLoadingProfile && anyDietActive) {
      setIsDietExpanded(true)
    }
  }, [isLoadingProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' })
      const data = await res.json() as { success?: boolean; errors?: string[]; error?: string }
      if (!res.ok) {
        setDeleteError(data.error ?? t('deletionFailed'))
        return
      }
      // Clear all local state then sign out
      localStorage.clear()
      await signOut()
      setShowDeleteModal(false)
      toast.success(t('deleteSuccessToast'))
      onDone()
    } catch {
      setDeleteError(t('deleteSomethingWrong'))
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Header subtitle ────────────────────────────────────────────────────────
  const allergenCount = preferences.allergens.length + (preferences.customAllergens?.length ?? 0)

  const headerSubtitle = (() => {
    const parts: string[] = []
    if (activePresetLabels.length > 0) parts.push(activePresetLabels.join(', '))
    if (preferences.lactoseIntolerant) parts.push(tPresets('lactose.shortLabel'))
    if (preferences.alcoholMode !== 'none') parts.push(tPresets('alcohol.shortLabel'))
    if (preferences.lowHistamine) parts.push(tPresets('lowHistamine.shortLabel'))
    if (allergenCount > 0) parts.push(allergenCount > 1 ? t('allergensShort', { count: allergenCount }) : t('allergenShort', { count: allergenCount }))
    if (parts.length === 0) return t('noRestrictionsSelected')
    return `${parts.join(' + ')}${t('restrictionsSuffix')}`
  })()

  return (
    <>
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={onDone} className="shrink-0 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
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
                {t('dietPresets')}
              </h2>
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                {anyDietActive
                  ? [
                      ...activePresetLabels,
                      ...(preferences.lactoseIntolerant ? [tPresets('lactose.shortLabel')] : []),
                      ...(preferences.alcoholMode !== 'none' ? [tPresets('alcohol.shortLabel')] : []),
                      ...(preferences.lowHistamine ? [tPresets('lowHistamine.shortLabel')] : []),
                    ].join(', ') + t('restrictionsSuffix')
                  : t('noneActive')}
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
                            <p className="text-sm font-medium text-foreground">{tPresets('lactose.title')}</p>
                            <p className="text-xs text-muted-foreground">
                              {preferences.lactoseIntolerant && preferences.lactoseMode === 'include'
                                ? tPresets('lactose.activeInclude')
                                : preferences.lactoseIntolerant
                                ? tPresets('lactose.activeExclude')
                                : tPresets('lactose.inactive')}
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
                                { value: 'include' as const, label: tPresets('lactose.includeLabel'), desc: tPresets('lactose.includeDesc') },
                                { value: 'exclude' as const, label: tPresets('lactose.excludeLabel'), desc: tPresets('lactose.excludeDesc') },
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

                    {/* No Alcohol */}
                    <div className={cn(
                      'rounded-xl border transition-colors',
                      preferences.alcoholMode !== 'none' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-card border-border'
                    )}>
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🍷</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{tPresets('alcohol.title')}</p>
                            <p className="text-xs text-muted-foreground">
                              {preferences.alcoholMode === 'no_cooking'
                                ? tPresets('alcohol.noCookingActive')
                                : preferences.alcoholMode === 'exclude_entirely'
                                ? tPresets('alcohol.excludeActive')
                                : tPresets('alcohol.inactive')}
                            </p>
                          </div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={preferences.alcoholMode !== 'none'}
                          onClick={() => setAlcoholMode(preferences.alcoholMode !== 'none' ? 'none' : 'no_cooking')}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                            preferences.alcoholMode !== 'none' ? 'bg-amber-500' : 'bg-secondary'
                          )}
                        >
                          <span className={cn(
                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                            preferences.alcoholMode !== 'none' ? 'translate-x-5' : 'translate-x-0'
                          )} />
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {preferences.alcoholMode !== 'none' && (
                          <motion.div
                            key="alcohol-mode"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 pt-1 space-y-1 border-t border-amber-500/20">
                              {([
                                { value: 'no_cooking' as const, label: tPresets('alcohol.noCookingLabel'), desc: tPresets('alcohol.noCookingDesc') },
                                { value: 'exclude_entirely' as const, label: tPresets('alcohol.excludeLabel'), desc: tPresets('alcohol.excludeDesc') },
                              ]).map(({ value, label, desc }) => (
                                <button
                                  key={value}
                                  onClick={() => setAlcoholMode(value)}
                                  className={cn(
                                    'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                                    preferences.alcoholMode === value ? 'bg-amber-500/10' : 'hover:bg-amber-500/5'
                                  )}
                                >
                                  <div className={cn(
                                    'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                                    preferences.alcoholMode === value ? 'border-amber-500 bg-amber-500' : 'border-muted-foreground'
                                  )}>
                                    {preferences.alcoholMode === value && (
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

                    {/* Low Histamine */}
                    <div className={cn(
                      'rounded-xl border transition-colors',
                      preferences.lowHistamine ? 'bg-amber-500/5 border-amber-500/30' : 'bg-card border-border'
                    )}>
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🧬</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">{tPresets('lowHistamine.name')}</p>
                            <p className="text-xs text-muted-foreground">
                              {tPresets('lowHistamine.description')}
                            </p>
                          </div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={preferences.lowHistamine}
                          onClick={() => setLowHistamine(!preferences.lowHistamine)}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                            preferences.lowHistamine ? 'bg-amber-500' : 'bg-secondary'
                          )}
                        >
                          <span className={cn(
                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform',
                            preferences.lowHistamine ? 'translate-x-5' : 'translate-x-0'
                          )} />
                        </button>
                      </div>
                      <p className="px-4 pb-3 text-xs text-muted-foreground">
                        ⚕️ {tPresets('lowHistamine.disclaimer')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* EU Big 14 grid */}
          <h2 className="text-sm font-medium text-muted-foreground mb-2">{t('euBig14')}</h2>
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

          {/* Cooking style */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <UtensilsCrossed className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">{t('cookingStyle')}</p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">{t('spiceTolerance')}</p>
                <div className="flex rounded-lg overflow-hidden border border-border bg-secondary">
                  {([
                    { value: 'none' as SpiceTolerance, label: tSpice('none') },
                    { value: 'mild' as SpiceTolerance, label: tSpice('mild') },
                    { value: 'medium' as SpiceTolerance, label: tSpice('medium') },
                    { value: 'hot' as SpiceTolerance, label: tSpice('hot') },
                  ]).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSpiceTolerance(value)}
                      className={cn(
                        'flex-1 py-2 text-xs font-medium transition-colors',
                        preferences.spiceTolerance === value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">{t('adventurousness')}</p>
                <div className="flex rounded-lg overflow-hidden border border-border bg-secondary">
                  {([
                    { value: 'familiar' as Adventurousness, label: tAdventurous('familiar') },
                    { value: 'occasional' as Adventurousness, label: tAdventurous('occasional') },
                    { value: 'adventurous' as Adventurousness, label: tAdventurous('adventurous') },
                  ]).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setAdventurousness(value)}
                      className={cn(
                        'flex-1 py-2 text-xs font-medium transition-colors',
                        preferences.adventurousness === value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Safe Foods Mode */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" style={{ color: '#16a34a' }} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('safeFoodsModeTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {preferences.safeIngredients.length === 0
                      ? t('safeFoodsModeEmpty')
                      : t('safeFoodsModeCount', { count: preferences.safeIngredients.length })}
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
                {t('safeFoodsModeDesc')}
              </p>
            )}

            <Button variant="outline" size="sm" onClick={onManageSafeFoods} className="w-full rounded-full gap-2">
              <ShieldCheck className="w-4 h-4" />
              {preferences.safeIngredients.length === 0 ? t('safeFoodsSetup') : t('safeFoodsManage')}
            </Button>
          </div>

          {/* Nutritional information toggle */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('macrosTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('macrosDesc')}</p>
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
                  {t('macrosSignInLink')}
                </button>
                {' '}{t('macrosSignInSuffix')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2.5">
                {t('macrosHiddenDesc')}
              </p>
            )}
          </div>

          {/* Theme */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              {colorMode === 'dark' ? <Moon className="w-5 h-5 text-muted-foreground" /> : colorMode === 'light' ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Monitor className="w-5 h-5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-semibold text-foreground">{t('theme')}</p>
                <p className="text-xs text-muted-foreground">{colorMode === 'system' ? t('themeFollowsDevice') : colorMode === 'dark' ? t('themeAlwaysDark') : t('themeAlwaysLight')}</p>
              </div>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-border bg-secondary">
              {([
                { value: 'light', label: t('themes.light'), Icon: Sun },
                { value: 'system', label: t('themes.system'), Icon: Monitor },
                { value: 'dark', label: t('themes.dark'), Icon: Moon },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => handleColorModeChange(value)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                    colorMode === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Discover settings */}
          <div className="py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Compass className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">{t('discoverSectionTitle')}</p>
            </div>
            {([
              { key: 'showDiscover' as const,         label: t('discover.showDiscover'),         desc: t('discover.showDiscoverDesc') },
              { key: 'showTrendingForYou' as const,   label: t('discover.showTrendingForYou'),   desc: t('discover.showTrendingForYouDesc') },
              { key: 'showTrendingGlobally' as const, label: t('discover.showTrendingGlobally'), desc: t('discover.showTrendingGloballyDesc') },
              { key: 'showMostLoved' as const,        label: t('discover.showMostLoved'),        desc: t('discover.showMostLovedDesc') },
              { key: 'showTrendingPairings' as const, label: t('discover.showTrendingPairings'), desc: t('discover.showTrendingPairingsDesc') },
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
              <p className="text-sm font-semibold text-foreground">{t('tabs')}</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{t('tabsMinimum')}</p>
            {ALL_TABS.map((tabId) => {
              const labelMap: Record<string, string> = {
                kitchen: t('tabLabels.kitchen'), recipe: t('tabLabels.recipe'), discover: t('tabLabels.discover'), substitutes: t('tabLabels.substitutes'), history: t('tabLabels.history'), saved: t('tabLabels.saved'),
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
                  <p className="text-sm font-semibold text-foreground">{t('onboarding')}</p>
                  <p className="text-xs text-muted-foreground">{t('revisitSlideshow')}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRestartTutorial}
                className="rounded-full text-xs"
              >
                {t('restartOnboarding')}
              </Button>
            </div>
          </div>

          {/* Account */}
          <div className="py-4 border-t border-border">
            {isSignedIn ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="w-5 h-5 text-destructive/70" />
                  <p className="text-sm font-semibold text-foreground">{t('account')}</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('accountDeleteDesc')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowDeleteModal(true); setDeleteError(null) }}
                  className="rounded-full text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {t('deleteAccount')}
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">{t('account')}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('accountGuest')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenAuth}
                  className="rounded-full text-xs"
                >
                  {t('accountSignIn')}
                </Button>
              </div>
            )}
          </div>

          {/* Done */}
          <div className="pt-4 border-t border-border mt-auto">
            <Button size="lg" onClick={onDone} className="w-full rounded-full py-6">
              {t('done')}
            </Button>
          </div>

        </div>
      </div>
    </div>

    {/* Delete account confirmation modal */}
    <AnimatePresence>
      {showDeleteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] flex items-center justify-center px-5 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setShowDeleteModal(false) }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-foreground mb-2">{t('deleteConfirmTitle')}</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {t('deleteConfirmBody')}
            </p>

            {deleteError && (
              <p className="text-xs text-destructive mb-4">{deleteError}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                {t('deleteCancel')}
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('deleteConfirm')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
