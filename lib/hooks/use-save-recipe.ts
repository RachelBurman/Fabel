import { useMutation, useQueryClient } from '@tanstack/react-query'

export type SaveRecipeInput = {
  userId: string
  recipe: Record<string, unknown>
}

async function saveRecipe(input: SaveRecipeInput): Promise<void> {
  const res = await fetch('/api/user/saved-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Save failed: ${res.status}`)
}

export function useSaveRecipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveRecipe,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['savedRecipes', variables.userId] })
    },
  })
}
