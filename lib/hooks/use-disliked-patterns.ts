import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

export type DislikedPatternsData = {
  patterns: string[]
  ingredients: string[]
}

async function fetchDislikedPatterns(userId: string): Promise<DislikedPatternsData> {
  const res = await fetch(
    `/api/feedback?userId=${encodeURIComponent(userId)}&liked=false&limit=5`
  )
  if (!res.ok) return { patterns: [], ingredients: [] }
  const data = await res.json() as { patterns?: string[]; ingredients?: string[] }
  return { patterns: data.patterns ?? [], ingredients: data.ingredients ?? [] }
}

export function useDislikedPatterns(userId: string) {
  return useQuery({
    queryKey: queryKeys.dislikedPatterns(userId),
    queryFn: () => fetchDislikedPatterns(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
