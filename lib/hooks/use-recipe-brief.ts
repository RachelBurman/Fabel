import { useMutation } from '@tanstack/react-query'
import { type RecipeBrief } from '@/lib/types'

export type RecipeBriefInput = Record<string, unknown>

export type RecipeBriefResult = {
  brief: RecipeBrief
}

async function fetchRecipeBrief(input: RecipeBriefInput): Promise<RecipeBriefResult> {
  const res = await fetch('/api/recipe-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Brief error: ${res.status}`)
  return res.json() as Promise<RecipeBriefResult>
}

export function useRecipeBrief() {
  return useMutation({ mutationFn: fetchRecipeBrief })
}
