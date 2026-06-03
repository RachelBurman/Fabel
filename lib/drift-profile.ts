import { computePreferenceProfile, type FeedbackRecord } from './feedback-preferences'

export interface DriftAwareProfile {
  preferred: string[]
  avoided: string[]
  scores: Record<string, number>
  emerging: string[]
  fading: string[]
  strength: 'none' | 'soft' | 'full'
  signalCount: number
}

/**
 * Extends computePreferenceProfile with drift detection by comparing an
 * all-time profile against the most recent 10 records.
 *
 * emerging — ingredients appearing in the recent top-5 preferred but absent
 *   from the all-time top-5. These are new interests worth exploring further.
 *
 * fading — ingredients in the all-time top-5 preferred but absent from the
 *   recent top-5. Tastes the user may be moving away from.
 *
 * Records must be pre-sorted descending by timestamp (most recent first).
 */
export function computeDriftAwareProfile(records: FeedbackRecord[]): DriftAwareProfile {
  const allTime = computePreferenceProfile(records)

  if (allTime.strength === 'none') {
    return {
      preferred: [],
      avoided: [],
      scores: {},
      emerging: [],
      fading: [],
      strength: 'none',
      signalCount: records.length,
    }
  }

  const recentRecords = records.slice(0, 10)
  const recent = computePreferenceProfile(recentRecords)

  const allTimePreferredSet = new Set(allTime.preferred)
  const recentPreferredSet = new Set(recent.preferred)

  const emerging = recent.preferred.filter(k => !allTimePreferredSet.has(k))
  const fading = allTime.preferred.filter(k => !recentPreferredSet.has(k))

  return {
    preferred: allTime.preferred,
    avoided: allTime.avoided,
    scores: allTime.scores,
    emerging,
    fading,
    strength: allTime.strength as 'soft' | 'full',
    signalCount: records.length,
  }
}
