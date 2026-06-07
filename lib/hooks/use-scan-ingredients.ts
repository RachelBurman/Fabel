import { useMutation } from '@tanstack/react-query'

export type ScanIngredientsInput = {
  image: string
  mediaType: string
  userId?: string | null
}

export type ScanIngredientsResult = {
  ingredients?: string[]
  error?: string
  resetAt?: string
  statusCode?: number
}

async function scanIngredients(input: ScanIngredientsInput): Promise<ScanIngredientsResult> {
  const res = await fetch('/api/scan-ingredients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: input.image,
      mediaType: input.mediaType,
      ...(input.userId ? { userId: input.userId } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; resetAt?: string }
    return { error: err.error, resetAt: err.resetAt, statusCode: res.status }
  }
  const data = await res.json() as { ingredients?: string[] }
  return { ingredients: data.ingredients }
}

export function useScanIngredients() {
  return useMutation({ mutationFn: scanIngredients })
}
