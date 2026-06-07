'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ALLERGENS, DIET_PRESETS, type SpiceTolerance, type Adventurousness } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Check, Leaf, ArrowRight, ShieldCheck, Shield, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CustomAllergenSearch } from '@/components/custom-allergen-search'
import { SafeFoodsScreen } from '@/components/safe-foods-screen'

interface OnboardingScreenProps {
  onComplete: () => void
}

type Step = 'welcome' | 'allergens' | 'cooking-style' | 'safe-foods-intro' | 'safe-foods-setup'

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { preferences, toggleAllergen, completeOnboarding, setSafeFoodsMode, togglePreset, setLactoseIntolerant, setLactoseMode, setSpiceTolerance, setAdventurousness } = useFable()
  const [step, setStep] = useState<Step>('welcome')
  const [isDietExpanded, setIsDietExpanded] = useState(false)
  const [localSpice, setLocalSpice] = useState<SpiceTolerance | null>(null)
  const [localAdventurousness, setLocalAdventurousness] = useState<Adventurousness | null>(null)

  const handleContinue = () => {
    if (step === 'welcome') setStep('allergens')
    else if (step === 'allergens') setStep('cooking-style')
    else if (step === 'cooking-style') {
      setSpiceTolerance(localSpice ?? 'medium')
      setAdventurousness(localAdventurousness ?? 'occasional')
      setStep('safe-foods-intro')
    }
  }

  const handleSkipSafeFoods = () => {
    completeOnboarding()
    onComplete()
  }

  const handleSetUpSafeFoods = () => {
    setStep('safe-foods-setup')
  }

  const handleSafeFoodsDone = () => {
    setSafeFoodsMode(true)
    completeOnboarding()
    onComplete()
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AnimatePresence mode="wait">
        {step === 'welcome' ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col items-center justify-center px-6 py-12"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mb-8"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Leaf className="w-10 h-10 text-primary" />
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-4xl md:text-5xl font-semibold text-foreground mb-4 text-center text-balance"
            >
              Welcome to Fable
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-lg text-muted-foreground text-center max-w-md mb-12 text-pretty"
            >
              Discover delicious recipes that are safe for you. We&apos;ll help you find flavour-matched meals tailored to your dietary needs.
            </motion.p>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="grid gap-4 mb-12 w-full max-w-sm"
            >
              {[
                { icon: ShieldCheck, text: 'Allergen-safe recipes' },
                { icon: Leaf, text: 'Fresh ingredient matching' },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-foreground font-medium">{feature.text}</span>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              <Button
                size="lg"
                onClick={handleContinue}
                className="rounded-full px-8 gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>
        ) : step === 'allergens' ? (
          <motion.div
            key="allergens"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col px-6 py-8 md:py-12"
          >
            <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">
              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-2 text-balance">
                  Your dietary restrictions
                </h2>
                <p className="text-muted-foreground text-pretty">
                  Set your diet and allergens — we&apos;ll filter recipes to match
                </p>
              </div>

              {/* Diet & Lifestyle — collapsible */}
              <div className="mb-6">
                <button
                  onClick={() => setIsDietExpanded(v => !v)}
                  className="flex items-center justify-between w-full text-left group mb-3"
                >
                  <h3 className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Diet &amp; Lifestyle
                  </h3>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    {preferences.activePresets.length > 0 || preferences.lactoseIntolerant
                      ? [
                          ...preferences.activePresets.map(id => DIET_PRESETS[id]?.label ?? id),
                          ...(preferences.lactoseIntolerant ? ['Lactose'] : []),
                        ].join(', ') + ' active'
                      : 'None active'}
                    <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', isDietExpanded && 'rotate-180')} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isDietExpanded && (
                    <motion.div
                      key="diet-onboarding"
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
                                key="lactose-mode-onboarding"
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

              {/* Allergen Grid — fills available height */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-3">
                {ALLERGENS.map((allergen, index) => {
                  const isSelected = preferences.allergens.includes(allergen.id)
                  return (
                    <motion.button
                      key={allergen.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03, duration: 0.2 }}
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
                      <span className={cn(
                        'text-xs font-medium text-center leading-tight',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {allergen.name}
                      </span>
                    </motion.button>
                  )
                })}
              </div>

              {/* Custom allergen search */}
              <div className="mb-6">
                <CustomAllergenSearch />
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {preferences.allergens.length === 0
                    ? 'No allergens selected'
                    : `${preferences.allergens.length} allergen${preferences.allergens.length > 1 ? 's' : ''} selected`}
                </p>
                <Button
                  size="lg"
                  onClick={handleContinue}
                  className="rounded-full px-8 gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : step === 'cooking-style' ? (
          <motion.div
            key="cooking-style"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col px-6 py-8 md:py-12"
          >
            <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-2 text-balance">
                  Your cooking style
                </h2>
                <p className="text-muted-foreground text-pretty">
                  You can change these any time in settings.
                </p>
              </div>

              {/* Spice tolerance */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">How do you feel about spice?</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { value: 'none' as const, label: 'No spice please', emoji: '🌿' },
                    { value: 'mild' as const, label: 'A little warmth', emoji: '🌶️' },
                    { value: 'medium' as const, label: 'Medium heat', emoji: '🌶️🌶️' },
                    { value: 'hot' as const, label: 'Bring it on', emoji: '🌶️🌶️🌶️' },
                  ]).map(({ value, label, emoji }) => (
                    <button
                      key={value}
                      onClick={() => setLocalSpice(value)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-center',
                        localSpice === value
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/50'
                      )}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className={cn('text-xs font-medium leading-tight', localSpice === value ? 'text-primary' : 'text-foreground')}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Adventurousness */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">How adventurous are you feeling?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { value: 'familiar' as const, label: 'Stick to what I know', emoji: '🏠' },
                    { value: 'occasional' as const, label: 'The occasional surprise', emoji: '🗺️' },
                    { value: 'adventurous' as const, label: 'Take me somewhere new', emoji: '🌍' },
                  ]).map(({ value, label, emoji }) => (
                    <button
                      key={value}
                      onClick={() => setLocalAdventurousness(value)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-center',
                        localAdventurousness === value
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/50'
                      )}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className={cn('text-xs font-medium leading-tight', localAdventurousness === value ? 'text-primary' : 'text-foreground')}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4 border-t border-border mt-auto">
                <Button
                  size="lg"
                  onClick={handleContinue}
                  className="rounded-full px-8 gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : step === 'safe-foods-intro' ? (
          <motion.div
            key="safe-foods-intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col items-center justify-center px-6 py-12"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mb-8"
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                   style={{ backgroundColor: 'rgba(34,197,94,0.12)' }}>
                <Shield className="w-10 h-10" style={{ color: '#16a34a' }} />
              </div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="text-3xl md:text-4xl font-semibold text-foreground mb-4 text-center text-balance"
            >
              Have a very restricted diet?
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="text-lg text-muted-foreground text-center max-w-md mb-4 text-pretty"
            >
              Tell us exactly what you <span className="text-foreground font-medium">can</span>{' '}eat and
              we&apos;ll work only within those ingredients — nothing outside your safe list.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              className="text-sm text-muted-foreground text-center max-w-sm mb-10"
            >
              Ideal for MCAS, severe allergies, or highly restricted therapeutic diets.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
              className="flex flex-col gap-3 w-full max-w-sm"
            >
              <Button
                size="lg"
                onClick={handleSetUpSafeFoods}
                className="w-full rounded-full gap-2 py-6"
              >
                <ShieldCheck className="w-5 h-5" />
                Yes, set up my safe foods list
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={handleSkipSafeFoods}
                className="w-full rounded-full gap-2"
              >
                No thanks, continue to the app
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="safe-foods-setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col px-6 py-8 md:py-12"
          >
            <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">
              <SafeFoodsScreen
                onDone={handleSafeFoodsDone}
                doneLabel="Save & Start Cooking"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
