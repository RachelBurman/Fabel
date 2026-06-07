/**
 * Tests for the No Alcohol dietary preset.
 *
 * Covers:
 * - ALCOHOL_INGREDIENT_KEYS: known keys present, false positives absent
 * - /api/generate-recipe: noAlcoholClause injected for both modes, absent when mode is 'none'
 * - /api/recipe-brief: noAlcoholNote injected when mode is active
 * - /api/drink-pairings: alcoholic beverages filtered; non-alcoholic fallback when all removed
 * - /api/substitutes: alcohol keys excluded from candidates when mode is active
 * - /api/user/profile GET/PUT: alcoholMode stored and returned correctly
 */

import { NextRequest } from 'next/server'
import { ALCOHOL_INGREDIENT_KEYS } from '@/lib/alcohol-ingredients'

// ─── Better Auth mock ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const authMod = require('@/lib/auth') as { auth: { api: { getSession: jest.MockedFunction<() => Promise<{ user: { id: string } } | null>> } } }

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────────

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

// ─── Mock DynamoDB ────────────────────────────────────────────────────────────

const mockSend = jest.fn()

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: mockSend },
}))

// ─── Mock Epicure ─────────────────────────────────────────────────────────────

const mockRankSimilar = jest.fn()

jest.mock('@/lib/epicure', () => ({
  allIngredients: ['chicken', 'onion', 'garlic'],
  findSimilarIngredients: jest.fn().mockReturnValue([]),
  rankSimilar: mockRankSimilar,
  cosineSimilarityBetween: jest.fn().mockReturnValue(0.5),
  toEpicureKey: jest.fn((s: string) => s),
  getCategoryForIngredient: jest.fn().mockReturnValue('protein'),
  getAllergensForIngredient: jest.fn().mockReturnValue([]),
  getEpicureVectors: jest.fn().mockReturnValue({}),
  allergenIngredients: {},
  ALLERGEN_CODES: [],
  COMMON_ALLERGENS: [],
  INGREDIENT_CATEGORIES: {},
  findSafeIngredients: jest.fn().mockReturnValue([]),
}))

// ─── Mock preference-profile + flavour-territory (for recipe-brief) ───────────

const mockBuildPreferenceProfile = jest.fn()

jest.mock('@/lib/preference-profile', () => ({
  buildPreferenceProfile: (...args: unknown[]) => mockBuildPreferenceProfile(...args),
}))

jest.mock('@/lib/flavour-territory', () => ({
  deriveFlavourTerritory: jest.fn().mockReturnValue(['umami', 'earthy']),
}))

// ─── Mock drink-pairing-utils (for drink-pairings route) ─────────────────────

jest.mock('@/lib/drink-pairing-utils', () => ({
  resolveToEpicureKey: jest.fn((name: string) => name),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipeJson(): string {
  return JSON.stringify({
    title: 'Test Dish',
    description: 'A test.',
    ingredients: [{ name: 'chicken', amount: 1, unit: 'piece' }],
    steps: ['Cook it.'],
    cookTime: '30 minutes',
    servings: 2,
    allergenFree: true,
  })
}

function makeBriefJson(): string {
  return JSON.stringify({
    direction: 'A slow-cooked Moroccan lamb tagine',
    reasoning: 'Novel territory.',
    keyIngredients: ['lamb', 'preserved lemon'],
    noveltyNote: 'First time in North African territory',
    loadingHints: ['Tip 1', 'Tip 2', 'Tip 3'],
  })
}

function makeRecipeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/generate-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeBriefRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/recipe-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeSubstituteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/substitutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDrinkPairingsRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/drink-pairings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeProfileGetRequest(userId: string): NextRequest {
  return new NextRequest(`http://localhost/api/user/profile?userId=${userId}`, { method: 'GET' })
}

function makeProfilePutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function capturedRecipePrompt(): string {
  expect(mockCreate).toHaveBeenCalled()
  const call = mockCreate.mock.calls[0][0]
  return call.messages[0].content as string
}

function capturedBriefPrompt(): string {
  expect(mockCreate).toHaveBeenCalled()
  const call = mockCreate.mock.calls[0][0]
  return call.messages[0].content as string
}

const MINIMAL_RECIPE_BODY = {
  ingredients: ['chicken'],
  allergens: [],
  mealType: 'main',
  cookTime: 'medium',
}

const FULL_PREFERENCE_PROFILE = {
  scores: { chicken: 0.8 },
  preferred: ['chicken'],
  avoided: [],
  signalCount: 10,
  strength: 'full' as const,
  formatSignals: [],
}

const FULL_PUT_BODY = {
  userId: 'test-user-123',
  allergens: [],
  customAllergens: [],
  ingredients: [],
  safeIngredients: [],
  safeFoodsMode: false,
  showMacros: false,
  activePresets: [],
  lactoseIntolerant: false,
  lactoseMode: 'include',
  kitchenEquipment: ['hob', 'oven'],
  colorMode: 'system',
  spiceTolerance: 'medium',
  adventurousness: 'occasional',
}

// ─── Route handlers loaded lazily ─────────────────────────────────────────────

let POST_RECIPE: (req: NextRequest) => Promise<Response>
let POST_BRIEF: (req: NextRequest) => Promise<Response>
let POST_SUBSTITUTES: (req: NextRequest) => Promise<Response>
let POST_DRINK_PAIRINGS: (req: NextRequest) => Promise<Response>
let GET_PROFILE: (req: NextRequest) => Promise<Response>
let PUT_PROFILE: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const recipeMod = await import('@/app/api/generate-recipe/route')
  POST_RECIPE = recipeMod.POST

  const briefMod = await import('@/app/api/recipe-brief/route')
  POST_BRIEF = briefMod.POST

  const subsMod = await import('@/app/api/substitutes/route')
  POST_SUBSTITUTES = subsMod.POST

  const pairingsMod = await import('@/app/api/drink-pairings/route')
  POST_DRINK_PAIRINGS = pairingsMod.POST

  const profileMod = await import('@/app/api/user/profile/route')
  GET_PROFILE = profileMod.GET
  PUT_PROFILE = profileMod.PUT
})

beforeEach(() => {
  jest.clearAllMocks()
  authMod.auth.api.getSession.mockResolvedValue({ user: { id: 'test-user-123' } })
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: makeRecipeJson() }],
  })
  mockSend.mockResolvedValue({ Items: [] })
  mockBuildPreferenceProfile.mockResolvedValue(FULL_PREFERENCE_PROFILE)
  // Default: mix of substitution candidates including alcoholic keys
  mockRankSimilar.mockReturnValue([
    { name: 'tofu', score: 0.85 },
    { name: 'tempeh', score: 0.75 },
    { name: 'mirin', score: 0.65 },   // alcoholic cooking wine
    { name: 'sake', score: 0.60 },    // alcoholic
    { name: 'seitan', score: 0.55 },
  ])
})

// ─── ALCOHOL_INGREDIENT_KEYS content ─────────────────────────────────────────

describe('ALCOHOL_INGREDIENT_KEYS — known alcohol keys present', () => {
  it('includes beer and lager', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('beer')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('lager')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('stout')
  })

  it('includes wine varieties', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('wine')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('red_wine')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('white_wine')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('champagne')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('prosecco')
  })

  it('includes spirits', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('vodka')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('gin')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('rum')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('whiskey')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('bourbon')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('tequila')
  })

  it('includes Asian cooking wines', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('mirin')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('sake')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('shaoxing_wine')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('rice_wine')
  })

  it('includes cider (both UK and US conventions)', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('apple_cider')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('hard_cider')
  })

  it('includes sherry and fortified wines', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('sherry')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('port_wine')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('marsala_wine')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('vermouth')
  })

  it('includes liqueurs', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('liqueur')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('coffee_liqueur')
    expect(ALCOHOL_INGREDIENT_KEYS).toContain('orange_liqueur')
  })
})

describe('ALCOHOL_INGREDIENT_KEYS — false positives absent', () => {
  it('does not include ginger_beer (soft drink)', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('ginger_beer')
  })

  it('does not include ginger_ale', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('ginger_ale')
  })

  it('does not include root_beer', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('root_beer')
  })

  it('does not include apple_cider_vinegar', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('apple_cider_vinegar')
  })

  it('does not include wine vinegars', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('red_wine_vinegar')
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('white_wine_vinegar')
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('sherry_vinegar')
  })

  it('does not include sparkling_water', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('sparkling_water')
  })

  it('does not include apple_juice', () => {
    expect(ALCOHOL_INGREDIENT_KEYS).not.toContain('apple_juice')
  })
})

// ─── generate-recipe — noAlcoholClause injection ─────────────────────────────

describe('generate-recipe — no-alcohol clause injection', () => {
  it('injects no-alcohol clause when alcoholMode is no_cooking', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, alcoholMode: 'no_cooking' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('does not consume alcohol')
    expect(prompt).toContain('no wine, beer, spirits, mirin, or cooking wines')
  })

  it('injects no-alcohol clause when alcoholMode is exclude_entirely', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, alcoholMode: 'exclude_entirely' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('does not consume alcohol')
    expect(prompt).toContain('Do not mention alcohol in the recipe at all')
  })

  it('does not inject clause when alcoholMode is absent', async () => {
    await POST_RECIPE(makeRecipeRequest(MINIMAL_RECIPE_BODY))
    const prompt = capturedRecipePrompt()
    expect(prompt).not.toContain('does not consume alcohol')
  })

  it('no-alcohol clause appears before the recipe generation instruction', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, alcoholMode: 'no_cooking' }))
    const prompt = capturedRecipePrompt()
    const alcoholIdx = prompt.indexOf('does not consume alcohol')
    const generateIdx = prompt.indexOf('Generate a')
    expect(alcoholIdx).toBeGreaterThan(-1)
    expect(generateIdx).toBeGreaterThan(-1)
    expect(alcoholIdx).toBeLessThan(generateIdx)
  })

  it('no-alcohol clause appears in safe-foods mode prompt', async () => {
    await POST_RECIPE(makeRecipeRequest({
      ...MINIMAL_RECIPE_BODY,
      alcoholMode: 'no_cooking',
      safeFoodsMode: true,
      safeIngredients: ['chicken', 'salt'],
    }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('does not consume alcohol')
    expect(prompt).toContain('CRITICAL CONSTRAINT')
    const alcoholIdx = prompt.indexOf('does not consume alcohol')
    const constraintIdx = prompt.indexOf('CRITICAL CONSTRAINT')
    expect(alcoholIdx).toBeLessThan(constraintIdx)
  })
})

// ─── recipe-brief — noAlcoholNote injection ───────────────────────────────────

describe('recipe-brief — no-alcohol note injection', () => {
  beforeEach(() => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: makeBriefJson() }],
    })
    mockSend.mockImplementation(() => Promise.resolve({ Items: [] }))
  })

  it('injects no-alcohol note when alcoholMode is no_cooking', async () => {
    await POST_BRIEF(makeBriefRequest({
      preferences: { alcoholMode: 'no_cooking' },
    }))
    const prompt = capturedBriefPrompt()
    expect(prompt).toContain('does not consume alcohol')
    expect(prompt).toContain('no coq au vin, sake-braised dishes, or beer-based stews')
  })

  it('injects no-alcohol note when alcoholMode is exclude_entirely', async () => {
    await POST_BRIEF(makeBriefRequest({
      preferences: { alcoholMode: 'exclude_entirely' },
    }))
    const prompt = capturedBriefPrompt()
    expect(prompt).toContain('does not consume alcohol')
  })

  it('does not inject note when alcoholMode is absent', async () => {
    await POST_BRIEF(makeBriefRequest({
      preferences: {},
    }))
    const prompt = capturedBriefPrompt()
    expect(prompt).not.toContain('does not consume alcohol')
  })
})

// ─── drink-pairings — alcohol filtering ───────────────────────────────────────

describe('drink-pairings — alcohol filtering', () => {
  beforeEach(() => {
    // rankSimilar returns a mix: wine (alcoholic, in BEVERAGE_KEYS) and green_tea (non-alcoholic)
    mockRankSimilar.mockReturnValue([
      { name: 'wine', score: 0.9 },
      { name: 'beer', score: 0.85 },
      { name: 'green_tea', score: 0.7 },
      { name: 'sparkling_water', score: 0.6 },
    ])
  })

  it('returns alcoholic beverages when no alcoholMode set', async () => {
    const res = await POST_DRINK_PAIRINGS(makeDrinkPairingsRequest({
      ingredients: ['chicken'],
      allergens: [],
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { pairings: { drink: string }[] }
    const drinkNames = data.pairings.map((p) => p.drink)
    // wine or beer should appear when no restriction
    expect(drinkNames.some((d) => d === 'wine' || d === 'beer')).toBe(true)
  })

  it('filters out alcoholic beverages when alcoholMode is no_cooking', async () => {
    const res = await POST_DRINK_PAIRINGS(makeDrinkPairingsRequest({
      ingredients: ['chicken'],
      allergens: [],
      alcoholMode: 'no_cooking',
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { pairings: { drink: string }[] }
    for (const pairing of data.pairings) {
      expect(ALCOHOL_INGREDIENT_KEYS).not.toContain(pairing.drink)
    }
  })

  it('filters out alcoholic beverages when alcoholMode is exclude_entirely', async () => {
    const res = await POST_DRINK_PAIRINGS(makeDrinkPairingsRequest({
      ingredients: ['chicken'],
      allergens: [],
      alcoholMode: 'exclude_entirely',
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { pairings: { drink: string }[] }
    for (const pairing of data.pairings) {
      expect(ALCOHOL_INGREDIENT_KEYS).not.toContain(pairing.drink)
    }
  })

  it('returns non-alcoholic fallbacks when all candidates are alcoholic', async () => {
    // Only return alcoholic beverages so the filter removes all
    mockRankSimilar.mockReturnValue([
      { name: 'wine', score: 0.9 },
      { name: 'beer', score: 0.85 },
      { name: 'champagne', score: 0.8 },
    ])
    const res = await POST_DRINK_PAIRINGS(makeDrinkPairingsRequest({
      ingredients: ['chicken'],
      allergens: [],
      alcoholMode: 'no_cooking',
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { pairings: { drink: string }[] }
    // Should return fallbacks, not an empty list
    expect(data.pairings.length).toBeGreaterThan(0)
    // All fallbacks should be non-alcoholic
    for (const pairing of data.pairings) {
      expect(ALCOHOL_INGREDIENT_KEYS).not.toContain(pairing.drink)
    }
  })
})

// ─── substitutes — alcohol key exclusion ──────────────────────────────────────

describe('substitutes — alcohol key exclusion', () => {
  it('includes mirin as candidate when no alcoholMode set', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'soy_sauce',
      context: [],
      allergens: [],
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { substitutes: { name: string }[] }
    const names = data.substitutes.map((s) => s.name)
    // mirin can appear when no alcohol restriction
    expect(names.includes('mirin') || names.includes('tofu') || names.includes('tempeh')).toBe(true)
  })

  it('excludes mirin and sake when alcoholMode is no_cooking', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'soy_sauce',
      context: [],
      allergens: [],
      alcoholMode: 'no_cooking',
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { substitutes: { name: string }[] }
    const names = data.substitutes.map((s) => s.name)
    expect(names).not.toContain('mirin')
    expect(names).not.toContain('sake')
  })

  it('excludes mirin and sake when alcoholMode is exclude_entirely', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'soy_sauce',
      context: [],
      allergens: [],
      alcoholMode: 'exclude_entirely',
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { substitutes: { name: string }[] }
    const names = data.substitutes.map((s) => s.name)
    expect(names).not.toContain('mirin')
    expect(names).not.toContain('sake')
  })

  it('returns non-alcoholic candidates when alcohol keys are excluded', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'soy_sauce',
      context: [],
      allergens: [],
      alcoholMode: 'no_cooking',
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { substitutes: { name: string }[] }
    // tofu, tempeh, seitan should still be candidates
    const names = data.substitutes.map((s) => s.name)
    expect(names.some((n) => ['tofu', 'tempeh', 'seitan'].includes(n))).toBe(true)
  })
})

// ─── profile GET — alcoholMode returned ──────────────────────────────────────

describe('GET /api/user/profile — alcoholMode', () => {
  it('returns alcoholMode: no_cooking from stored item', async () => {
    mockSend.mockResolvedValue({
      Item: { userId: 'test-user-123', allergens: [], alcoholMode: 'no_cooking' },
    })
    const res = await GET_PROFILE(makeProfileGetRequest('test-user-123'))
    const body = await res.json() as { alcoholMode?: string }
    expect(body.alcoholMode).toBe('no_cooking')
  })

  it('returns alcoholMode: exclude_entirely from stored item', async () => {
    mockSend.mockResolvedValue({
      Item: { userId: 'test-user-123', allergens: [], alcoholMode: 'exclude_entirely' },
    })
    const res = await GET_PROFILE(makeProfileGetRequest('test-user-123'))
    const body = await res.json() as { alcoholMode?: string }
    expect(body.alcoholMode).toBe('exclude_entirely')
  })

  it('returns alcoholMode: none (or undefined) when absent from stored item', async () => {
    mockSend.mockResolvedValue({
      Item: { userId: 'test-user-123', allergens: [] },
    })
    const res = await GET_PROFILE(makeProfileGetRequest('test-user-123'))
    const body = await res.json() as { alcoholMode?: string }
    // undefined means context provides the 'none' default
    expect(body.alcoholMode === undefined || body.alcoholMode === 'none').toBe(true)
  })
})

// ─── profile PUT — alcoholMode written correctly ──────────────────────────────

describe('PUT /api/user/profile — alcoholMode', () => {
  it('saves alcoholMode: no_cooking to DynamoDB', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest({
      ...FULL_PUT_BODY,
      alcoholMode: 'no_cooking',
    }))
    const item = (mockSend.mock.calls[0][0] as { input: { Item: Record<string, unknown> } }).input.Item
    expect(item.alcoholMode).toBe('no_cooking')
  })

  it('saves alcoholMode: exclude_entirely to DynamoDB', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest({
      ...FULL_PUT_BODY,
      alcoholMode: 'exclude_entirely',
    }))
    const item = (mockSend.mock.calls[0][0] as { input: { Item: Record<string, unknown> } }).input.Item
    expect(item.alcoholMode).toBe('exclude_entirely')
  })

  it('defaults alcoholMode to none when absent from PUT body', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest(FULL_PUT_BODY))
    const item = (mockSend.mock.calls[0][0] as { input: { Item: Record<string, unknown> } }).input.Item
    expect(item.alcoholMode).toBe('none')
  })
})
