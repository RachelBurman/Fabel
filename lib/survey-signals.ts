export interface SurveyResponse {
  ingredientsHighlighted: string[]
  ingredientsSkipped: string[]
  recipePositives: string[]
  recipeNegatives: string[]
}

// Signals with no injection (Right amount of ingredients, Perfect complexity) are omitted
const RECIPE_SIGNAL_MAP: Record<string, string> = {
  'Too complex':          "Keep the method simple — minimal steps, straightforward techniques.",
  'Too simple':           "The user wants more interesting techniques or a more ambitious recipe.",
  'Wrong cuisine vibe':   "Avoid cuisine styles similar to previous recipes the user has disliked.",
  'Great cuisine choice': "The user responded well to this cuisine style — lean into similar flavours.",
  'Too many ingredients': "Use a tight ingredient list — aim for 8 or fewer ingredients.",
  'Quick to make':        "The user appreciated the speed of this recipe — keep cook time short.",
  'Took too long':        "Keep cook time short — previous recipes that took too long received negative feedback.",
}

/**
 * Compute per-ingredient score adjustments from survey responses.
 * Each highlighted ingredient contributes +1.5, each skipped -1.5.
 * 1.5× the weight of a plain like/dislike — active choice vs passive thumbs.
 */
export function computeSurveyIngredientAdjustments(
  records: Array<{ surveyResponse?: SurveyResponse }>
): Record<string, number> {
  const adjustments: Record<string, number> = {}
  for (const record of records) {
    if (!record.surveyResponse) continue
    for (const ing of record.surveyResponse.ingredientsHighlighted ?? []) {
      const key = ing.toLowerCase().trim()
      adjustments[key] = (adjustments[key] ?? 0) + 1.5
    }
    for (const ing of record.surveyResponse.ingredientsSkipped ?? []) {
      const key = ing.toLowerCase().trim()
      adjustments[key] = (adjustments[key] ?? 0) - 1.5
    }
  }
  return adjustments
}

/**
 * Map pre-aggregated signal strings to prompt clauses via RECIPE_SIGNAL_MAP.
 * Signals not in the map (e.g. 'Perfect complexity') are silently dropped.
 */
export function formatSignalsToClauses(signals: string[]): string[] {
  return signals.map((s) => RECIPE_SIGNAL_MAP[s]).filter(Boolean) as string[]
}

/**
 * Build recipe format injection clauses from survey responses.
 * Only injects a signal if it appears in 2+ records (noise suppression).
 */
export function buildRecipeFormatClauses(
  records: Array<{ surveyResponse?: SurveyResponse }>
): string[] {
  const counts: Record<string, number> = {}
  for (const record of records) {
    if (!record.surveyResponse) continue
    const signals = [
      ...(record.surveyResponse.recipePositives ?? []),
      ...(record.surveyResponse.recipeNegatives ?? []),
    ]
    for (const signal of signals) {
      counts[signal] = (counts[signal] ?? 0) + 1
    }
  }

  const clauses: string[] = []
  for (const [signal, count] of Object.entries(counts)) {
    if (count >= 2 && RECIPE_SIGNAL_MAP[signal]) {
      clauses.push(RECIPE_SIGNAL_MAP[signal])
    }
  }
  return clauses
}
