import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './query-keys'
import { type IngredientItem } from '@/lib/types'

export type ProfileData = {
  allergens?: string[]
  customAllergens?: string[]
  ingredients?: (string | IngredientItem)[]
  safeIngredients?: string[]
  safeFoodsMode?: boolean
  showMacros?: boolean
  activePresets?: string[]
  lactoseIntolerant?: boolean
  lactoseMode?: 'include' | 'exclude'
  alcoholMode?: 'none' | 'no_cooking' | 'exclude_entirely'
  kitchenEquipment?: string[]
  colorMode?: string
  discoverSettings?: Record<string, unknown>
  visibleTabs?: string[]
  onboardingComplete?: boolean
  spiceTolerance?: string
  adventurousness?: string
  lowHistamine?: boolean
}

async function fetchProfile(userId: string): Promise<ProfileData> {
  const res = await fetch(`/api/user/profile?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return {}
  return res.json() as Promise<ProfileData>
}

export function useProfile(userId: string, isSignedIn: boolean) {
  return useQuery({
    queryKey: queryKeys.profile(userId, isSignedIn),
    queryFn: () => fetchProfile(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
