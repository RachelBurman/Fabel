import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

async function fetchIngredientSearch(query: string): Promise<string[]> {
  const res = await fetch(`/api/ingredients?q=${encodeURIComponent(query)}`)
  if (!res.ok) return []
  const data = await res.json() as { results: string[] }
  return data.results
}

export function useIngredientSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.ingredientSearch(query),
    queryFn: () => fetchIngredientSearch(query),
    enabled: query.trim().length > 0,
    staleTime: 30 * 1000,
    placeholderData: [],
  })
}
