// Minimal mock of @/lib/fable-context.
// DiscoverSection only needs: preferences.discoverSettings, userId, isSignedIn.
import React, { createContext, useContext } from 'react'

const mockValue = {
  userId: 'maya-demo-id',
  isSignedIn: true,
  preferences: {
    discoverSettings: {
      showTrendingForYou: true,
      showTrendingGlobally: true,
      showMostLoved: true,
      showTrendingPairings: true,
    },
  },
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FableContext = createContext<any>(mockValue)

export function useFable() {
  return useContext(FableContext)
}

export function FableProvider({ children }: { children: React.ReactNode }) {
  return <FableContext.Provider value={mockValue}>{children}</FableContext.Provider>
}
