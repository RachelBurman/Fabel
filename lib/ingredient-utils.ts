/**
 * Pure ingredient name normalisation utilities.
 * No Node.js dependencies — safe to import in both server and client code.
 */

export const MODIFIER_PREFIXES = new Set([
  'tinned', 'canned', 'jarred', 'grated', 'fresh', 'dried', 'frozen',
  'smoked', 'brown', 'plain', 'ground', 'whole', 'chopped', 'sliced',
  'diced', 'minced', 'crushed', 'large', 'small', 'medium', 'baby',
  'ripe', 'raw', 'cooked', 'roasted', 'toasted',
])

export const INGREDIENT_SYNONYMS: Record<string, string> = {
  // Pasta shapes
  fusilli: 'pasta', spaghetti: 'pasta', penne: 'pasta', rigatoni: 'pasta',
  tagliatelle: 'pasta', linguine: 'pasta', fettuccine: 'pasta',
  farfalle: 'pasta', rotini: 'pasta', macaroni: 'pasta', orzo: 'pasta',
  // Corn
  'sweet corn': 'corn', sweetcorn: 'corn',
  // British / regional
  courgette: 'zucchini', aubergine: 'eggplant', capsicum: 'pepper',
  prawn: 'shrimp', coriander: 'cilantro', rocket: 'arugula',
  // Dairy
  'cheddar cheese': 'cheese', cheddar: 'cheese', parmesan: 'cheese',
  mozzarella: 'cheese', brie: 'cheese', feta: 'cheese',
  // Flour variants
  'self raising flour': 'flour', 'self-raising flour': 'flour',
  'strong flour': 'flour', 'bread flour': 'flour', 'wholemeal flour': 'flour',
}

const SKIP_WORDS = new Set(['or', 'and', 'the', 'a', 'an', 'to', 'of'])
const PREP_WORDS = new Set([
  'salted', 'unsalted', 'softened', 'melted', 'chopped', 'diced', 'sliced',
  'crushed', 'minced', 'grated', 'shredded', 'rinsed', 'drained', 'peeled',
  'trimmed', 'finely', 'coarsely', 'roughly', 'thinly', 'thickly', 'optional',
])

/**
 * Generate normalised candidate strings to try for Epicure key resolution,
 * most specific first. Handles:
 *   - Parenthetical descriptions: "Pasta (Penne Or Rigatoni)" → tries "pasta",
 *     then "penne" / "rigatoni" as fallbacks
 *   - Comma-separated descriptors: "garlic cloves, thinly sliced" → "garlic cloves"
 *   - Modifier prefixes: "tinned tuna" → "tuna"
 *   - Prep-phrase suffixes: "onion, finely diced" → "onion"
 *   - Ingredient synonyms: "fusilli" → "pasta"
 *   - Individual-word fallbacks with singularisation (longest first)
 */
export function normaliseCandidates(raw: string): string[] {
  // 1. Strip descriptor after the first top-level comma (ignore commas inside parens)
  let beforeComma = raw
  let depth = 0
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '(') { depth++; continue }
    if (raw[i] === ')') { depth--; continue }
    if (raw[i] === ',' && depth === 0) { beforeComma = raw.slice(0, i); break }
  }
  beforeComma = beforeComma.trim()

  // 2. Collect words from parenthetical alternatives before stripping them.
  //    Filter out stop words and prep/descriptor words so only real ingredient
  //    names (e.g. "penne", "cream") are kept as fallback candidates.
  const parenWords: string[] = (beforeComma.match(/\(([^)]+)\)/g) ?? [])
    .flatMap((m) => m.slice(1, -1).split(/[\s/,]+/))
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 2 && !SKIP_WORDS.has(w) && !PREP_WORDS.has(w) && !MODIFIER_PREFIXES.has(w))

  // 3. Strip parenthetical content from the base name
  const clean = beforeComma.replace(/\s*\(.*?\)/g, '').trim()
  const lower = clean.toLowerCase()

  const candidates: string[] = []
  const addWithSynonym = (s: string) => {
    candidates.push(s)
    const syn = INGREDIENT_SYNONYMS[s]
    if (syn) candidates.push(syn)
  }

  addWithSynonym(lower)

  // Strip trailing prep phrases ("finely chopped", "diced", etc.)
  const stripped = lower
    .replace(/,?\s*(finely\s+)?(chopped|diced|sliced|crushed|minced|grated|shredded|rinsed|drained|peeled|trimmed)\s*$/i, '')
    .trim()
  if (stripped !== lower) addWithSynonym(stripped)

  // Strip leading modifier prefix (first word only)
  const words = stripped.split(/\s+/)
  if (words.length > 1 && MODIFIER_PREFIXES.has(words[0])) {
    const noPrefix = words.slice(1).join(' ')
    addWithSynonym(noPrefix)
    // Strip second prefix if still present (e.g. "tinned chopped tomatoes")
    const words2 = noPrefix.split(/\s+/)
    if (words2.length > 1 && MODIFIER_PREFIXES.has(words2[0])) {
      addWithSynonym(words2.slice(1).join(' '))
    }
  }

  // Individual words from the base name as fallbacks (longest first).
  // Also try the singular form of each word ("tomatoes" → "tomato").
  const core = (candidates[candidates.length - 1] ?? lower).split(/\s+/).filter((w) => w.length > 2)
  for (const w of core.sort((a, b) => b.length - a.length)) {
    addWithSynonym(w)
    const sing =
      w.endsWith('ies') && w.length > 4 ? w.slice(0, -3) + 'y' :
      w.endsWith('ves') && w.length > 4 ? w.slice(0, -3) + 'f' :
      w.endsWith('es')  && w.length > 4 && !w.endsWith('ies') ? w.slice(0, -2) :
      w.endsWith('s')   && !w.endsWith('ss') && w.length > 4  ? w.slice(0, -1) :
      null
    if (sing && sing !== w) addWithSynonym(sing)
  }

  // Parenthetical alternatives as final fallbacks
  for (const w of parenWords) {
    addWithSynonym(w)
  }

  return [...new Set(candidates)]
}
