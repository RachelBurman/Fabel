'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ALLERGENS } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Check, Leaf, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CustomAllergenSearch } from '@/components/custom-allergen-search'

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { preferences, toggleAllergen, completeOnboarding } = useFable()
  const [step, setStep] = useState<'welcome' | 'allergens'>('welcome')

  const handleContinue = () => {
    if (step === 'welcome') {
      setStep('allergens')
    } else {
      completeOnboarding()
      onComplete()
    }
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
        ) : (
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
                  Select your allergens
                </h2>
                <p className="text-muted-foreground text-pretty">
                  We&apos;ll filter out recipes that contain these ingredients
                </p>
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
        )}
      </AnimatePresence>
    </div>
  )
}
