import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

export type SavedRecipesData = {
  recipes: Record<string, unknown>[]
}

async function fetchSavedRecipes(userId: string): Promise<SavedRecipesData> {
  const res = await fetch(`/api/user/saved-recipes?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return { recipes: [] }
  return res.json() as Promise<SavedRecipesData>
}

export function useSavedRecipes(userId: string, isSignedIn: boolean) {
  return useQuery({
    queryKey: queryKeys.savedRecipes(userId, isSignedIn),
    queryFn: () => fetchSavedRecipes(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })
}
