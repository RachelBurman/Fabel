import { useMutation } from '@tanstack/react-query'

export type UpdateProfileInput = {
  userId: string
  allergens: string[]
  customAllergens: string[]
  ingredients: unknown[]
  safeIngredients: string[]
  safeFoodsMode: boolean
  showMacros: boolean
  activePresets: string[]
  lactoseIntolerant: boolean
  lactoseMode: 'include' | 'exclude'
  alcoholMode: 'none' | 'no_cooking' | 'exclude_entirely'
  kitchenEquipment: string[]
  colorMode: 'light' | 'dark' | 'system'
  discoverSettings: unknown
  visibleTabs: string[]
  spiceTolerance: string
  adventurousness: string
  onboardingComplete: boolean
}

async function updateProfile(input: UpdateProfileInput): Promise<void> {
  await fetch('/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function useUpdateProfile() {
  return useMutation({ mutationFn: updateProfile })
}
