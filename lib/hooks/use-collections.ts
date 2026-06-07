import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

export type CollectionsData = {
  collections: Record<string, unknown>[]
}

async function fetchCollections(userId: string): Promise<CollectionsData> {
  const res = await fetch(`/api/user/collections?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return { collections: [] }
  return res.json() as Promise<CollectionsData>
}

export function useCollections(userId: string, isSignedIn: boolean) {
  return useQuery({
    queryKey: queryKeys.collections(userId, isSignedIn),
    queryFn: () => fetchCollections(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })
}
