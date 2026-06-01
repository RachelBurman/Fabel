// Pure functions — no DynamoDB or Epicure dependencies. Testable in isolation.

export interface FeedbackRecord {
  liked: boolean
  recipeIngredients: string[]
  timestamp: string
}

export type ProfileStrength = 'none' | 'soft' | 'full'

export interface PreferenceProfile {
  preferred: string[]                // top 5 positive-scored ingredient names
  avoided: string[]                  // top 5 most negative-scored ingredient names
  scores: Record<string, number>     // all qualifying ingredient scores
  strength: ProfileStrength
}

/**
 * Compute per-ingredient preference scores from a set of feedback records.
 *
 * score = (like_count − dislike_count) / total_appearances
 *
 * Rules:
 *  - Ingredients with fewer than 2 total appearances are excluded (noise filter).
 *  - Ingredients with a score of exactly 0 (equal likes and dislikes) are excluded
 *    from both preferred and avoided lists.
 *  - Fewer than 3 records → strength 'none', no injection.
 *  - 3–9 records → strength 'soft', softened prompt language.
 *  - 10+ records → strength 'full', full prompt injection.
 */
export function computePreferenceProfile(records: FeedbackRecord[]): PreferenceProfile {
  if (records.length < 3) {
    return { preferred: [], avoided: [], scores: {}, strength: 'none' }
  }

  const strength: ProfileStrength = records.length >= 10 ? 'full' : 'soft'

  const likeCounts: Record<string, number> = {}
  const dislikeCounts: Record<string, number> = {}

  for (const record of records) {
    const ings = (record.recipeIngredients ?? []).filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0
    )
    for (const ing of ings) {
      const key = ing.toLowerCase().trim()
      if (record.liked) {
        likeCounts[key] = (likeCounts[key] ?? 0) + 1
      } else {
        dislikeCounts[key] = (dislikeCounts[key] ?? 0) + 1
      }
    }
  }

  const allKeys = new Set([...Object.keys(likeCounts), ...Object.keys(dislikeCounts)])
  const scores: Record<string, number> = {}

  for (const key of allKeys) {
    const likes = likeCounts[key] ?? 0
    const dislikes = dislikeCounts[key] ?? 0
    const total = likes + dislikes
    if (total < 2) continue
    const score = (likes - dislikes) / total
    if (score === 0) continue  // equal likes+dislikes — no clear signal
    scores[key] = score
  }

  // Sorted descending — positive (preferred) at start, negative (avoided) at end
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const preferred = sorted.filter(([, s]) => s > 0).slice(0, 5).map(([k]) => k)
  const avoided = [...sorted].reverse().filter(([, s]) => s < 0).slice(0, 5).map(([k]) => k)

  return { preferred, avoided, scores, strength }
}

/**
 * Build the taste-profile section to prepend to the Claude prompt.
 * Returns an empty string when there is nothing worth injecting.
 */
export function buildTasteProfileClause(profile: PreferenceProfile): string {
  if (profile.strength === 'none') return ''
  if (profile.preferred.length === 0 && profile.avoided.length === 0) return ''

  const lines: string[] = []

  if (profile.strength === 'soft') {
    if (profile.preferred.length > 0) {
      lines.push(`This user is starting to show a preference for: ${profile.preferred.join(', ')}`)
    }
    if (profile.avoided.length > 0) {
      lines.push(`This user is starting to show a preference against: ${profile.avoided.join(', ')}`)
    }
    return `User taste profile (early signals — still accumulating data):\n${lines.join('\n')}\n\n`
  }

  if (profile.preferred.length > 0) {
    lines.push(`Tends to enjoy: ${profile.preferred.join(', ')}`)
  }
  if (profile.avoided.length > 0) {
    lines.push(`Tends to avoid: ${profile.avoided.join(', ')}`)
  }
  return `User taste profile (learned from their recipe history):\n${lines.join('\n')}\n\n`
}
