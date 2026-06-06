'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface DrinkPairing {
  drink: string
  score: number
}

function formatDrinkName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getDrinkEmoji(key: string): string {
  if (key.includes('tea'))                                               return '🍵'
  if (key === 'coffee')                                                  return '☕'
  if (key.includes('milk') || key === 'buttermilk')                     return '🥛'
  if (key.includes('beer') || key.includes('cider') || key === 'ginger_ale') return '🍺'
  if (key.includes('wine') || key === 'champagne' || key === 'sake')    return '🍷'
  if (key.includes('juice'))                                             return '🧃'
  if (['whiskey', 'rum', 'gin', 'vodka'].includes(key) || key.includes('liqueur')) return '🍸'
  return '🥤'
}

export function SharedDrinkPairings({ ingredients }: { ingredients: string[] }) {
  const [pairings, setPairings] = useState<DrinkPairing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const top3 = ingredients.slice(0, 3)
    fetch('/api/drink-pairings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: top3, allergens: [] }),
    })
      .then(res => res.json())
      .then((data: { pairings: DrinkPairing[] }) => setPairings(data.pairings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="pb-4">
      <h2 className="text-lg font-semibold text-foreground mb-4">Drink Pairings</h2>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Finding drink pairings…</span>
        </div>
      )}
      {!loading && pairings.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {pairings.map(({ drink }) => (
              <span
                key={drink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
              >
                {getDrinkEmoji(drink)} {formatDrinkName(drink)}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Drink suggestions are based on flavour matching. Always check ingredients against your dietary requirements.
          </p>
        </>
      )}
      {!loading && pairings.length === 0 && (
        <p className="text-sm text-muted-foreground">No drink suggestions found.</p>
      )}
    </section>
  )
}
