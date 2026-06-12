import { useMutation } from '@tanstack/react-query'

export type SubstituteResult = {
  name: string
  displayName: string
  similarityToOriginal: number
  contextFit: number
  combinedScore: number
  explanation: string | null
}

export type SubstitutesInput = {
  ingredient: string
  context: string[]
  allergens: string[]
  safeIngredients?: string[]
  userId?: string | null
  adventurousness?: string
  alcoholMode?: string
  lowHistamine?: boolean
}

export type SubstitutesResult = {
  substitutes: SubstituteResult[]
}

async function fetchSubstitutes(input: SubstitutesInput): Promise<SubstitutesResult> {
  const res = await fetch('/api/substitutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ingredient: input.ingredient,
      context: input.context,
      allergens: input.allergens,
      ...(input.safeIngredients && input.safeIngredients.length > 0
        ? { safeIngredients: input.safeIngredients }
        : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.adventurousness ? { adventurousness: input.adventurousness } : {}),
      ...(input.alcoholMode && input.alcoholMode !== 'none'
        ? { alcoholMode: input.alcoholMode }
        : {}),
      ...(input.lowHistamine ? { lowHistamine: true } : {}),
    }),
  })
  if (res.status === 429) {
    const data = await res.json().catch(() => ({})) as { resetAt?: string }
    throw Object.assign(new Error('rate_limited'), { resetAt: data.resetAt })
  }
  if (!res.ok) throw new Error('API error')
  return res.json() as Promise<SubstitutesResult>
}

export function useSubstitutes() {
  return useMutation({ mutationFn: fetchSubstitutes })
}
