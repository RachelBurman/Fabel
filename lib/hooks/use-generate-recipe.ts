import { useMutation } from '@tanstack/react-query'
import { type GeneratedRecipe } from '@/lib/types'

// _signal is extracted before serialisation and never sent to the server
export type GenerateRecipeInput = { _signal?: AbortSignal } & Record<string, unknown>

export type GenerateRecipeResult = GeneratedRecipe & {
  rateLimited?: boolean
  guestMode?: boolean
  recipe?: GeneratedRecipe
  hourRemaining?: number
  dayRemaining?: number
  resetAt?: string
}

async function generateRecipe({ _signal, ...body }: GenerateRecipeInput): Promise<GenerateRecipeResult> {
  const res = await fetch('/api/generate-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(_signal ? { signal: _signal } : {}),
  })
  if (!res.ok) throw new Error(`Generate error: ${res.status}`)
  return res.json() as Promise<GenerateRecipeResult>
}

export function useGenerateRecipe() {
  return useMutation({ mutationFn: generateRecipe })
}
