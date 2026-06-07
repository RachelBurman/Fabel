import { useMutation } from '@tanstack/react-query'

export type SaveRecipeInput = {
  userId: string
  recipe: Record<string, unknown>
}

async function saveRecipe(input: SaveRecipeInput): Promise<void> {
  await fetch('/api/user/saved-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function useSaveRecipe() {
  return useMutation({ mutationFn: saveRecipe })
}
