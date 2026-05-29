import {
  findSimilarIngredients,
  cosineSimilarityBetween,
  toEpicureKey,
  rankSimilar,
  normaliseCandidates,
} from '../epicure'

describe('findSimilarIngredients', () => {
  it('returns the requested number of results for a known ingredient', () => {
    const result = findSimilarIngredients('chicken', 5)
    expect(result).toHaveLength(5)
    expect(result.every((r) => typeof r === 'string')).toBe(true)
  })

  it('does not include the queried ingredient in results', () => {
    const result = findSimilarIngredients('chicken', 10)
    expect(result).not.toContain('chicken')
  })

  it('returns empty array for an unknown ingredient without throwing', () => {
    expect(findSimilarIngredients('zzz_not_a_real_ingredient', 5)).toEqual([])
  })
})

describe('rankSimilar', () => {
  it('returns objects with name and score properties', () => {
    const results = rankSimilar('garlic').slice(0, 5)
    results.forEach(({ name, score }) => {
      expect(typeof name).toBe('string')
      expect(typeof score).toBe('number')
    })
  })

  it('returns results in descending score order', () => {
    const results = rankSimilar('butter').slice(0, 10)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })

  it('returns empty array for unknown ingredient', () => {
    expect(rankSimilar('zzz_not_real')).toEqual([])
  })
})

describe('cosineSimilarityBetween', () => {
  it('returns a value between 0 and 1 for known ingredients', () => {
    const score = cosineSimilarityBetween('chicken', 'beef')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('scores semantically related ingredients higher than unrelated ones', () => {
    const butterToOliveOil = cosineSimilarityBetween('butter', 'olive_oil')
    const butterToPasta    = cosineSimilarityBetween('butter', 'pasta')
    expect(butterToOliveOil).toBeGreaterThan(butterToPasta)
  })

  it('returns 0 when either ingredient is unknown', () => {
    expect(cosineSimilarityBetween('chicken', 'zzz_not_real')).toBe(0)
    expect(cosineSimilarityBetween('zzz_not_real', 'chicken')).toBe(0)
  })
})

describe('normaliseCandidates', () => {
  it('strips parenthetical descriptions and uses the clean base name', () => {
    const candidates = normaliseCandidates('Pasta (Penne Or Rigatoni)')
    expect(candidates).toContain('pasta')
  })

  it('includes parenthetical words as fallback candidates', () => {
    const candidates = normaliseCandidates('Pasta (Penne Or Rigatoni)')
    expect(candidates.some((c) => c === 'pasta' || c === 'penne')).toBe(true)
  })

  it('strips comma-separated descriptors before resolving', () => {
    const candidates = normaliseCandidates('garlic cloves, thinly sliced')
    expect(candidates).toContain('garlic')
  })

  it('handles parenthetical alternatives for dairy', () => {
    const candidates = normaliseCandidates('Milk (or cream)')
    expect(candidates).toContain('milk')
    expect(candidates.some((c) => c === 'milk' || c === 'cream')).toBe(true)
  })

  it('strips parenthetical descriptions for simple ingredients', () => {
    const candidates = normaliseCandidates('Butter (unsalted)')
    expect(candidates).toContain('butter')
  })

  it('handles comma descriptors on onion', () => {
    const candidates = normaliseCandidates('onion, finely diced')
    expect(candidates).toContain('onion')
  })

  it('handles comma descriptors on cherry tomatoes', () => {
    const candidates = normaliseCandidates('cherry tomatoes, halved')
    expect(candidates).toContain('tomato')
  })

  it('does not split on commas inside parentheses', () => {
    const candidates = normaliseCandidates('Butter (salted, softened)')
    expect(candidates).toContain('butter')
    expect(candidates).not.toContain('softened')
  })
})

describe('toEpicureKey', () => {
  it('lowercases the input', () => {
    expect(toEpicureKey('CHICKEN')).toBe('chicken')
    expect(toEpicureKey('Olive Oil')).toBe('olive_oil')
  })

  it('replaces spaces with underscores', () => {
    expect(toEpicureKey('olive oil')).toBe('olive_oil')
    expect(toEpicureKey('chicken breast')).toBe('chicken_breast')
  })

  it('trims leading and trailing whitespace', () => {
    expect(toEpicureKey('  garlic  ')).toBe('garlic')
  })

  it('preserves underscores in multi-word names', () => {
    expect(toEpicureKey('tinned tuna')).toBe('tinned_tuna')
    expect(toEpicureKey('plain flour')).toBe('plain_flour')
  })
})
