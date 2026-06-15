// Replaces @/lib/hooks/use-insights — returns Maya's pre-seeded data directly,
// no network call, no QueryClient required.
import { MAYA_INSIGHTS } from '../mock/maya'

export function useInsights(_userId: string, _isSignedIn: boolean) {
  return { data: MAYA_INSIGHTS, isLoading: false, isError: false }
}
