/**
 * Unit tests for the kitchen equipment detection logic.
 *
 * The EQUIPMENT_RULES and detectMissingEquipment function are mirrored from
 * components/generated-recipe-screen.tsx so these tests remain pure (no DOM,
 * no React, no network).
 */

// ─── Mirrored from generated-recipe-screen.tsx ───────────────────────────────

const EQUIPMENT_RULES: { key: string; label: string; pattern: RegExp }[] = [
  { key: 'hob',         label: 'Hob',            pattern: /\b(hob|stovetop|saucepan|frying pan|boil(s|ed|ing)?)\b/i },
  { key: 'oven',        label: 'Oven',            pattern: /\b(bake[ds]?|baking|roast(s|ed|ing)?|grill(s|ed|ing)?)\b|(?<!pizza )\boven\b/i },
  { key: 'microwave',   label: 'Microwave',       pattern: /\bmicrowave\b/i },
  { key: 'air_fryer',   label: 'Air Fryer',       pattern: /\bair[ -]fr(yer|ied|ies|y(ing|s)?)\b/i },
  { key: 'slow_cooker', label: 'Slow Cooker',     pattern: /\bslow[ -]cook(er|s|ing|ed)?\b/i },
  { key: 'pizza_oven',  label: 'Pizza Oven',      pattern: /\bpizza oven\b/i },
  { key: 'barbecue',    label: 'Barbecue/Grill',  pattern: /\b(barbecue[ds]?|bbq|grill(s|ed|ing)?)\b/i },
]

function detectMissingEquipment(steps: string[], userEquipment: string[]): string[] {
  const has = new Set(userEquipment)
  const allText = steps.join(' ')
  const missing: string[] = []
  for (const rule of EQUIPMENT_RULES) {
    if (!has.has(rule.key) && rule.pattern.test(allText)) {
      missing.push(rule.label)
    }
  }
  return missing
}

// ─── Hob detection ────────────────────────────────────────────────────────────

describe('hob keyword detection', () => {
  const steps = (text: string) => [text]
  const withoutHob = [] as string[]

  it('detects "hob"', () => {
    expect(detectMissingEquipment(steps('Place the pan on the hob.'), withoutHob)).toContain('Hob')
  })

  it('detects "stovetop"', () => {
    expect(detectMissingEquipment(steps('Cook on the stovetop over medium heat.'), withoutHob)).toContain('Hob')
  })

  it('detects "saucepan"', () => {
    expect(detectMissingEquipment(steps('Add to a saucepan and bring to a simmer.'), withoutHob)).toContain('Hob')
  })

  it('detects "frying pan"', () => {
    expect(detectMissingEquipment(steps('Heat a frying pan over high heat.'), withoutHob)).toContain('Hob')
  })

  it('detects "boil"', () => {
    expect(detectMissingEquipment(steps('Bring water to a boil.'), withoutHob)).toContain('Hob')
  })

  it('detects "boiling"', () => {
    expect(detectMissingEquipment(steps('Add pasta to boiling salted water.'), withoutHob)).toContain('Hob')
  })

  it('detects "boiled"', () => {
    expect(detectMissingEquipment(steps('Serve with boiled rice.'), withoutHob)).toContain('Hob')
  })

  it('does NOT flag when user has hob', () => {
    expect(detectMissingEquipment(steps('Bring to a boil.'), ['hob'])).not.toContain('Hob')
  })
})

// ─── Oven detection ───────────────────────────────────────────────────────────

describe('oven keyword detection', () => {
  const steps = (text: string) => [text]
  const withoutOven = [] as string[]

  it('detects "oven"', () => {
    expect(detectMissingEquipment(steps('Place in the oven at 180°C.'), withoutOven)).toContain('Oven')
  })

  it('detects "bake"', () => {
    expect(detectMissingEquipment(steps('Bake for 25 minutes until golden.'), withoutOven)).toContain('Oven')
  })

  it('detects "baked"', () => {
    expect(detectMissingEquipment(steps('Serve the baked dish.'), withoutOven)).toContain('Oven')
  })

  it('detects "baking"', () => {
    expect(detectMissingEquipment(steps('Baking at 200°C gives a crispy crust.'), withoutOven)).toContain('Oven')
  })

  it('detects "roast"', () => {
    expect(detectMissingEquipment(steps('Roast the vegetables for 30 minutes.'), withoutOven)).toContain('Oven')
  })

  it('detects "roasted"', () => {
    expect(detectMissingEquipment(steps('Top with roasted garlic.'), withoutOven)).toContain('Oven')
  })

  it('detects "roasting"', () => {
    expect(detectMissingEquipment(steps('Roasting brings out natural sweetness.'), withoutOven)).toContain('Oven')
  })

  it('detects "grill"', () => {
    expect(detectMissingEquipment(steps('Grill for 3 minutes each side.'), withoutOven)).toContain('Oven')
  })

  it('does NOT detect "pizza oven" as requiring a regular Oven', () => {
    // "pizza oven" contains "oven" but the negative lookbehind should prevent a false flag
    const result = detectMissingEquipment(steps('Cook in the pizza oven for 90 seconds.'), ['pizza_oven'])
    expect(result).not.toContain('Oven')
  })

  it('does NOT flag when user has oven', () => {
    expect(detectMissingEquipment(steps('Bake at 180°C.'), ['oven'])).not.toContain('Oven')
  })
})

// ─── Microwave detection ──────────────────────────────────────────────────────

describe('microwave keyword detection', () => {
  it('detects "microwave" as a verb', () => {
    expect(detectMissingEquipment(['Microwave on high for 2 minutes.'], [])).toContain('Microwave')
  })

  it('detects "microwave" as a noun', () => {
    expect(detectMissingEquipment(['Heat in a microwave until warm.'], [])).toContain('Microwave')
  })

  it('does NOT flag when user has microwave', () => {
    expect(detectMissingEquipment(['Microwave for 90 seconds.'], ['microwave'])).not.toContain('Microwave')
  })
})

// ─── Air fryer detection ──────────────────────────────────────────────────────

describe('air fryer keyword detection', () => {
  it('detects "air fry"', () => {
    expect(detectMissingEquipment(['Air fry at 200°C for 15 minutes.'], [])).toContain('Air Fryer')
  })

  it('detects "air fryer"', () => {
    expect(detectMissingEquipment(['Place in the air fryer basket.'], [])).toContain('Air Fryer')
  })

  it('detects "air-fry" (hyphenated)', () => {
    expect(detectMissingEquipment(['Air-fry until crisp.'], [])).toContain('Air Fryer')
  })

  it('detects "air fried"', () => {
    expect(detectMissingEquipment(['Serve the air fried chips.'], [])).toContain('Air Fryer')
  })

  it('does NOT flag when user has air_fryer', () => {
    expect(detectMissingEquipment(['Air fry at 180°C.'], ['air_fryer'])).not.toContain('Air Fryer')
  })
})

// ─── Slow cooker detection ────────────────────────────────────────────────────

describe('slow cooker keyword detection', () => {
  it('detects "slow cooker"', () => {
    expect(detectMissingEquipment(['Transfer to a slow cooker.'], [])).toContain('Slow Cooker')
  })

  it('detects "slow cook"', () => {
    expect(detectMissingEquipment(['Slow cook on low for 8 hours.'], [])).toContain('Slow Cooker')
  })

  it('detects "slow cooking"', () => {
    expect(detectMissingEquipment(['Slow cooking develops deeper flavour.'], [])).toContain('Slow Cooker')
  })

  it('detects "slow-cook" (hyphenated)', () => {
    expect(detectMissingEquipment(['Slow-cook overnight.'], [])).toContain('Slow Cooker')
  })

  it('does NOT flag when user has slow_cooker', () => {
    expect(detectMissingEquipment(['Add to the slow cooker.'], ['slow_cooker'])).not.toContain('Slow Cooker')
  })
})

// ─── Pizza oven detection ─────────────────────────────────────────────────────

describe('pizza oven keyword detection', () => {
  it('detects "pizza oven"', () => {
    expect(detectMissingEquipment(['Cook in the pizza oven at 450°C.'], [])).toContain('Pizza Oven')
  })

  it('does NOT flag when user has pizza_oven', () => {
    expect(detectMissingEquipment(['Use a pizza oven for best results.'], ['pizza_oven'])).not.toContain('Pizza Oven')
  })
})

// ─── Barbecue detection ───────────────────────────────────────────────────────

describe('barbecue keyword detection', () => {
  it('detects "barbecue"', () => {
    expect(detectMissingEquipment(['Cook on the barbecue over direct heat.'], [])).toContain('Barbecue/Grill')
  })

  it('detects "bbq"', () => {
    expect(detectMissingEquipment(['BBQ the chicken until charred.'], [])).toContain('Barbecue/Grill')
  })

  it('detects "grill"', () => {
    expect(detectMissingEquipment(['Grill on high heat for 4 minutes.'], [])).toContain('Barbecue/Grill')
  })

  it('detects "grilled"', () => {
    expect(detectMissingEquipment(['Serve the grilled peppers on top.'], [])).toContain('Barbecue/Grill')
  })

  it('detects "grilling"', () => {
    expect(detectMissingEquipment(['Grilling seals in the juices.'], [])).toContain('Barbecue/Grill')
  })

  it('does NOT flag when user has barbecue', () => {
    expect(detectMissingEquipment(['Grill on the barbecue.'], ['barbecue'])).not.toContain('Barbecue/Grill')
  })
})

// ─── Multi-step scanning ─────────────────────────────────────────────────────

describe('multi-step detection', () => {
  it('detects equipment implied across multiple steps', () => {
    const steps = [
      'Boil the pasta for 10 minutes.',
      'Meanwhile, bake the sauce in the oven at 160°C.',
      'Combine and serve.',
    ]
    const missing = detectMissingEquipment(steps, [])
    expect(missing).toContain('Hob')
    expect(missing).toContain('Oven')
  })

  it('returns an empty array when no equipment keywords are present', () => {
    const steps = ['Mix all ingredients together.', 'Refrigerate for 1 hour.', 'Serve chilled.']
    expect(detectMissingEquipment(steps, [])).toEqual([])
  })

  it('returns an empty array when the user has all required equipment', () => {
    const steps = ['Boil water.', 'Bake for 20 minutes.', 'Microwave for 2 minutes.']
    expect(detectMissingEquipment(steps, ['hob', 'oven', 'microwave'])).toEqual([])
  })

  it('only reports equipment the user is missing, not all detected equipment', () => {
    const steps = ['Boil the stock.', 'Bake in the oven.']
    const missing = detectMissingEquipment(steps, ['hob']) // user has hob but not oven
    expect(missing).not.toContain('Hob')
    expect(missing).toContain('Oven')
  })
})

// ─── No false positives ───────────────────────────────────────────────────────

describe('false positive prevention', () => {
  it('does not flag "boilerplate" as needing a Hob', () => {
    expect(detectMissingEquipment(['Add boilerplate seasoning.'], [])).not.toContain('Hob')
  })

  it('does not flag "oven" inside "pizza oven" when user has pizza_oven', () => {
    const result = detectMissingEquipment(
      ['Place in the pizza oven for 2 minutes.'],
      ['pizza_oven']
    )
    expect(result).not.toContain('Oven')
  })

  it('does not flag Hob when user has hob even with multiple hob keywords', () => {
    const steps = ['Boil water in a saucepan on the hob.']
    expect(detectMissingEquipment(steps, ['hob'])).not.toContain('Hob')
  })

  it('returns no duplicates — each equipment label appears at most once', () => {
    const steps = ['Bake at 180°C then roast for 10 more minutes in the oven.']
    const missing = detectMissingEquipment(steps, [])
    const ovenCount = missing.filter(m => m === 'Oven').length
    expect(ovenCount).toBe(1)
  })
})

// ─── Case insensitivity ───────────────────────────────────────────────────────

describe('case insensitivity', () => {
  it('detects "BOIL" (uppercase)', () => {
    expect(detectMissingEquipment(['BOIL the water first.'], [])).toContain('Hob')
  })

  it('detects "Microwave" (title case)', () => {
    expect(detectMissingEquipment(['Microwave on HIGH for 3 minutes.'], [])).toContain('Microwave')
  })

  it('detects "BBQ" (all caps)', () => {
    expect(detectMissingEquipment(['Cook on the BBQ until charred.'], [])).toContain('Barbecue/Grill')
  })
})
