import { useMutation } from '@tanstack/react-query'

export type DrinkPairing = {
  drink: string
  score: number
}

export type DrinkPairingsInput = {
  ingredients: string[]
  allergens: string[]
  alcoholMode?: string
}

export type DrinkPairingsResult = {
  pairings: DrinkPairing[]
}

async function fetchDrinkPairings(input: DrinkPairingsInput): Promise<DrinkPairingsResult> {
  const res = await fetch('/api/drink-pairings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) return { pairings: [] }
  return res.json() as Promise<DrinkPairingsResult>
}

export function useDrinkPairings() {
  return useMutation({ mutationFn: fetchDrinkPairings })
}
