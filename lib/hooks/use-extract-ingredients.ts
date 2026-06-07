import { useMutation } from '@tanstack/react-query'

export type ExtractIngredientsInput = {
  text: string
  userId?: string | null
}

export type ExtractIngredientsResult = {
  ingredients: string[]
  rateLimitResetAt?: string
}

async function extractIngredients(input: ExtractIngredientsInput): Promise<ExtractIngredientsResult> {
  const res = await fetch('/api/extract-ingredients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input.text, ...(input.userId ? { userId: input.userId } : {}) }),
  })
  if (res.status === 429) {
    const data = await res.json().catch(() => ({})) as { resetAt?: string }
    return { ingredients: [], rateLimitResetAt: data.resetAt }
  }
  if (!res.ok) return { ingredients: [] }
  const data = await res.json() as { ingredients: string[] }
  return { ingredients: data.ingredients }
}

export function useExtractIngredients() {
  return useMutation({ mutationFn: extractIngredients })
}
