'use client'

import { motion } from 'framer-motion'
import { ALLERGENS } from '@/lib/types'
import { useFable } from '@/lib/fable-context'
import { Check, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CustomAllergenSearch } from '@/components/custom-allergen-search'

interface AllergenScreenProps {
  onDone: () => void
}

export function AllergenScreen({ onDone }: AllergenScreenProps) {
  const { preferences, toggleAllergen } = useFable()

  const totalCount = preferences.allergens.length + (preferences.customAllergens?.length ?? 0)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={onDone}
              className="shrink-0 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Allergen Settings</h1>
              <p className="text-sm text-muted-foreground">
                {totalCount === 0 ? 'No restrictions selected' : `${totalCount} restriction${totalCount > 1 ? 's' : ''} active`}
              </p>
            </div>
          </div>

          {/* EU Big 14 grid */}
          <h2 className="text-sm font-medium text-muted-foreground mb-3">EU Big 14 Allergens</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
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
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                  <span className="text-2xl">{allergen.icon}</span>
                  <span className={cn('text-sm font-medium text-center', isSelected ? 'text-primary' : 'text-foreground')}>
                    {allergen.name}
                  </span>
                </motion.button>
              )
            })}
          </div>

          <div className="mb-6">
            <CustomAllergenSearch />
          </div>

          {/* Done button */}
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
