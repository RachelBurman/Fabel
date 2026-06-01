// Safe-foods validation — extracted from /api/generate-recipe so logic can be
// unit-tested independently of the Next.js route.

// Only truly universal items safe for essentially everyone.
// Salt is deliberately excluded — MCAS users control it via their safe list.
export const UNIVERSAL_BASICS = new Set(['water', 'ice'])

// Placeholder names Claude uses when a class of ingredient isn't in the safe list.
export const SPECIAL_PLACEHOLDERS = new Set(['liquid of choice', 'seasoning of choice'])

// Words describing cooking form, technique, or cut — stripped before matching.
export const QUALIFIERS = new Set([
  'fresh', 'dried', 'frozen', 'raw', 'cooked', 'whole', 'organic',
  'ripe', 'firm', 'baby', 'unripe',
  'large', 'small', 'medium',
  'minced', 'chopped', 'sliced', 'diced', 'grated', 'roasted', 'steamed',
  'shredded', 'cubed', 'mashed', 'pureed', 'blended', 'crushed', 'peeled',
  'ground', 'toasted', 'blanched', 'sauteed', 'fried', 'grilled', 'baked',
  'piece', 'pieces', 'fillet', 'fillets', 'floret', 'florets',
  'clove', 'cloves', 'stalk', 'stalks', 'leaf', 'leaves',
  'sprig', 'sprigs', 'chunk', 'chunks', 'strip', 'strips', 'cube',
  'slice', 'slices', 'wedge', 'wedges', 'ring', 'rings',
  'breast', 'thigh', 'wing', 'drumstick', 'tenderloin', 'loin',
  'chop', 'chops', 'cutlet', 'cutlets', 'rack',
  'boneless', 'skinless',
])

export const LIQUID_TERMS = [
  'water', 'broth', 'stock', 'milk', 'juice', 'cream', 'wine', 'beer',
  'coconut milk', 'oat milk', 'almond milk', 'rice milk', 'soy milk',
  'buttermilk', 'kefir', 'tea', 'coffee', 'cider', 'vinegar',
  'consomme', 'dashi', 'gravy', 'syrup', 'nectar',
]

export const SALT_TERMS = [
  'salt', 'sea salt', 'kosher salt', 'himalayan salt', 'table salt',
  'fleur de sel', 'rock salt', 'pickling salt',
]

/** Build a normalised Set from Epicure-style keys ("olive_oil" → "olive oil"). */
export function buildSafeSet(safeIngredients: string[]): Set<string> {
  return new Set(
    safeIngredients.map(s => s.replace(/_/g, ' ').toLowerCase().trim())
  )
}

/**
 * Find all entries in safeSet that match any of the given terms using
 * whole-word matching. Returns the display form of matching safe entries.
 */
export function findInSafeSet(safeSet: Set<string>, terms: string[]): string[] {
  const found: string[] = []
  for (const safe of safeSet) {
    for (const term of terms) {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${esc}\\b`, 'i').test(safe)) {
        found.push(safe)
        break
      }
    }
  }
  return found
}

/** Return the word plus common singular/plural variants. */
export function wordVariants(word: string): string[] {
  const out = [word]
  if (word.endsWith('ies') && word.length > 4) out.push(word.slice(0, -3) + 'y')
  if (word.endsWith('ves') && word.length > 4) out.push(word.slice(0, -3) + 'f')
  if (word.endsWith('es') && word.length > 4 && !word.endsWith('ies'))
    out.push(word.slice(0, -2))
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4)
    out.push(word.slice(0, -1))
  return out
}

/**
 * Returns true when a recipe ingredient can be traced to the user's safe list.
 *
 * Matching order:
 *  1. Universal basics (water, ice).
 *  2. Special placeholders ("liquid of choice", "seasoning of choice").
 *  3. Salt-family: any salt recipe ingredient passes if the user has any salt.
 *  4. Exact normalised match against the safe set.
 *  5. Whole-phrase: a safe entry appears verbatim inside the recipe name.
 *  6. Core-word: after stripping qualifiers, each remaining word (plus its
 *     singular/plural variants) is checked against the first token of every
 *     safe entry.
 */
export function isSafe(name: string, safeSet: Set<string>, safeSalts: string[]): boolean {
  const norm = name.toLowerCase().trim()

  if (UNIVERSAL_BASICS.has(norm)) return true
  if (SPECIAL_PLACEHOLDERS.has(norm)) return true

  if (
    safeSalts.length > 0 &&
    SALT_TERMS.some(st => {
      const esc = st.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${esc}\\b`, 'i').test(norm)
    })
  ) {
    return true
  }

  if (safeSet.has(norm)) return true

  for (const safe of safeSet) {
    const esc = safe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${esc}\\b`, 'i').test(norm)) return true
  }

  const cores = norm.split(/\s+/).filter(w => w.length > 1 && !QUALIFIERS.has(w))
  for (const core of cores) {
    for (const variant of wordVariants(core)) {
      for (const safe of safeSet) {
        if (safe === variant || safe.split(/\s+/)[0] === variant) return true
      }
    }
  }

  return false
}

export interface RecipeIngredient {
  name?: unknown
  [key: string]: unknown
}

/**
 * Strip recipe ingredients not on the safe list.
 * Returns the cleaned recipe plus a list of what was removed.
 */
export function validateSafeFoods(
  recipe: Record<string, unknown>,
  safeSet: Set<string>,
  safeSalts: string[],
): { recipe: Record<string, unknown>; violations: string[] } {
  const raw = recipe.ingredients
  if (!Array.isArray(raw)) return { recipe, violations: [] }

  const violations: string[] = []
  const cleaned = raw.filter(item => {
    if (typeof item !== 'object' || item === null) return true
    const ing = item as Record<string, unknown>
    const ingName = typeof ing.name === 'string' ? ing.name.trim() : ''
    if (!ingName) return true
    if (isSafe(ingName, safeSet, safeSalts)) return true
    violations.push(ingName)
    return false
  })

  return { recipe: { ...recipe, ingredients: cleaned }, violations }
}
