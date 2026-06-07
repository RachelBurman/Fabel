import { useMutation } from '@tanstack/react-query'

export type RecipeSafeExplainInput = {
  recipeTitle: string
  ingredients: string[]
  allergens: string[]
  dietPresets: string[]
  safeFoodsMode: boolean
  safeFoods?: string[]
  lactoseMode?: string
}

export type RecipeSafeExplainResult = {
  explanation: string
}

async function fetchRecipeSafeExplain(input: RecipeSafeExplainInput): Promise<RecipeSafeExplainResult> {
  const res = await fetch('/api/recipe-safe-explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Safe explain failed')
  return res.json() as Promise<RecipeSafeExplainResult>
}

export function useRecipeSafeExplain() {
  return useMutation({ mutationFn: fetchRecipeSafeExplain })
}
