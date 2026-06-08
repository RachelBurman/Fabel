import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

export type InsightsData = {
  profileKey?: string
  weekStr?: string
  allergens?: string[]
  customAllergens?: string[]
  profileWeek?: unknown
  profileAllTime?: unknown
  globalWeek?: unknown
  tasteProfile?: {
    preferred: string[]
    avoided: string[]
    flavourTerritory: string[]
  }
  trendingForYou?: unknown[]
}

async function fetchInsights(userId: string): Promise<InsightsData> {
  const res = await fetch(`/api/insights?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return {}
  return res.json() as Promise<InsightsData>
}

export function useInsights(userId: string, isSignedIn: boolean) {
  return useQuery({
    queryKey: queryKeys.insights(userId, isSignedIn),
    queryFn: () => fetchInsights(userId),
    enabled: !!userId,
    staleTime: 60 * 60 * 1000,
  })
}
