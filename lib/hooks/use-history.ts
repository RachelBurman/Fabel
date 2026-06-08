import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

export type HistoryData = {
  entries: Record<string, unknown>[]
}

async function fetchHistory(userId: string): Promise<HistoryData> {
  const res = await fetch(`/api/user/history?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return { entries: [] }
  return res.json() as Promise<HistoryData>
}

export function useHistory(userId: string, isSignedIn: boolean) {
  return useQuery({
    queryKey: queryKeys.history(userId, isSignedIn),
    queryFn: () => fetchHistory(userId),
    enabled: !!userId && isSignedIn,
    staleTime: 2 * 60 * 1000,
  })
}
