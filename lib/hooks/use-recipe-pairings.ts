import { useMutation } from '@tanstack/react-query'
import { type PairingSuggestion } from '@/lib/types'

export type { PairingSuggestion }

export type RecipePairingsInput = Record<string, unknown>

export type RecipePairingsResult = {
  suggestions: PairingSuggestion[]
}

async function fetchRecipePairings(input: RecipePairingsInput): Promise<RecipePairingsResult> {
  const res = await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Pairings error: ${res.status}`)
  return res.json() as Promise<RecipePairingsResult>
}

export function useRecipePairings() {
  return useMutation({ mutationFn: fetchRecipePairings })
}
