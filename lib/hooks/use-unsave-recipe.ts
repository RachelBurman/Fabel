import { useMutation, useQueryClient } from '@tanstack/react-query'

export type UnsaveRecipeInput = {
  recipeId: string
  userId: string
}

async function unsaveRecipe({ recipeId, userId }: UnsaveRecipeInput): Promise<void> {
  const res = await fetch(
    `/api/user/saved-recipes/${encodeURIComponent(recipeId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  )
  if (!res.ok) throw new Error(`Unsave failed: ${res.status}`)
}

export function useUnsaveRecipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: unsaveRecipe,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['savedRecipes', variables.userId] })
    },
  })
}
