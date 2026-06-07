import { useMutation } from '@tanstack/react-query'

export type UnsaveRecipeInput = {
  recipeId: string
  userId: string
}

async function unsaveRecipe({ recipeId, userId }: UnsaveRecipeInput): Promise<void> {
  await fetch(
    `/api/user/saved-recipes/${encodeURIComponent(recipeId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  )
}

export function useUnsaveRecipe() {
  return useMutation({ mutationFn: unsaveRecipe })
}
