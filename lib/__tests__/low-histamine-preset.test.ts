/**
 * Tests for the Low Histamine dietary preset.
 *
 * Covers:
 * - HIGH_HISTAMINE_INGREDIENT_KEYS: correct ingredient categories present
 * - HIGH_HISTAMINE_INGREDIENT_KEYS: alcohol keys included via ALCOHOL_INGREDIENT_KEYS spread
 * - /api/generate-recipe: lowHistamineClause injected in normal and safe-foods paths
 * - /api/generate-recipe: clause absent when lowHistamine is false
 * - /api/recipe-brief: lowHistamineNote injected when lowHistamine is true
 * - /api/recipe-brief: note absent when lowHistamine is false
 * - /api/drink-pairings: histamine-trigger beverages filtered out when lowHistamine is true
 * - /api/substitutes: histamine candidates excluded from results when lowHistamine is true
 * - /api/user/profile GET/PUT: lowHistamine stored and returned correctly
 */

import { NextRequest } from 'next/server'
import { HIGH_HISTAMINE_INGREDIENT_KEYS } from '@/lib/high-histamine-ingredients'
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
    direction: 'A simple poached chicken',
    reasoning: 'Fresh and easy.',
    keyIngredients: ['chicken', 'herbs'],
    noveltyNote: 'First time in poaching territory',
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
  // Default: mix of candidates including histamine-trigger keys
  mockRankSimilar.mockReturnValue([
    { name: 'tofu', score: 0.85 },
    { name: 'soy_sauce', score: 0.80 },
    { name: 'miso', score: 0.75 },
    { name: 'yogurt', score: 0.65 },
    { name: 'tempeh', score: 0.60 },
  ])
})

// ─── HIGH_HISTAMINE_INGREDIENT_KEYS content ───────────────────────────────────

describe('HIGH_HISTAMINE_INGREDIENT_KEYS — fermented foods present', () => {
  it('includes core fermented condiments', () => {
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('soy_sauce')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('fish_sauce')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('miso')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('sauerkraut')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('kimchi')
  })

  it('includes vinegars as histamine triggers', () => {
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('vinegar')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('balsamic_vinegar')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('apple_cider_vinegar')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('red_wine_vinegar')
  })
})

describe('HIGH_HISTAMINE_INGREDIENT_KEYS — aged cheeses and cured meats present', () => {
  it('includes aged cheeses', () => {
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('parmesan_cheese')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('cheddar_cheese')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('blue_cheese')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('gruyere_cheese')
  })

  it('includes cured meats', () => {
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('bacon')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('ham')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('salami')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('prosciutto')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('chorizo')
  })
})

describe('HIGH_HISTAMINE_INGREDIENT_KEYS — common histamine triggers present', () => {
  it('includes high-histamine vegetables and fruits', () => {
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('tomato')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('spinach')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('avocado')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('eggplant')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('strawberry')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('banana')
  })

  it('includes citrus fruits', () => {
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('lemon')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('lime')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('orange')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('grapefruit')
  })
})

describe('HIGH_HISTAMINE_INGREDIENT_KEYS — alcohol keys included via spread', () => {
  it('includes all ALCOHOL_INGREDIENT_KEYS', () => {
    for (const key of ALCOHOL_INGREDIENT_KEYS) {
      expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain(key)
    }
  })

  it('includes wine and beer (spot check)', () => {
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('wine')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('beer')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('sake')
    expect(HIGH_HISTAMINE_INGREDIENT_KEYS).toContain('mirin')
  })
})

// ─── generate-recipe — lowHistamineClause injection ──────────────────────────

describe('generate-recipe — low-histamine clause injection', () => {
  it('injects low-histamine clause when lowHistamine is true', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, lowHistamine: true }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('low-histamine diet')
    expect(prompt).toContain('fermented foods')
  })

  it('does not inject clause when lowHistamine is absent', async () => {
    await POST_RECIPE(makeRecipeRequest(MINIMAL_RECIPE_BODY))
    const prompt = capturedRecipePrompt()
    expect(prompt).not.toContain('low-histamine diet')
  })

  it('does not inject clause when lowHistamine is false', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, lowHistamine: false }))
    const prompt = capturedRecipePrompt()
    expect(prompt).not.toContain('low-histamine diet')
  })

  it('injects clause in safe-foods mode when lowHistamine is true', async () => {
    await POST_RECIPE(makeRecipeRequest({
      ...MINIMAL_RECIPE_BODY,
      lowHistamine: true,
      safeFoodsMode: true,
      safeIngredients: ['chicken', 'rice'],
    }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('low-histamine diet')
    expect(prompt).toContain('CRITICAL CONSTRAINT')
  })
})

// ─── recipe-brief — lowHistamineNote injection ───────────────────────────────

describe('recipe-brief — low-histamine note injection', () => {
  beforeEach(() => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: makeBriefJson() }],
    })
    mockSend.mockImplementation(() => Promise.resolve({ Items: [] }))
  })

  it('injects low-histamine note when lowHistamine is true', async () => {
    await POST_BRIEF(makeBriefRequest({
      preferences: { lowHistamine: true },
    }))
    const prompt = capturedBriefPrompt()
    expect(prompt).toContain('low-histamine diet')
    expect(prompt).toContain('fermented, aged, cured')
  })

  it('does not inject note when lowHistamine is absent', async () => {
    await POST_BRIEF(makeBriefRequest({
      preferences: {},
    }))
    const prompt = capturedBriefPrompt()
    expect(prompt).not.toContain('low-histamine diet')
  })

  it('does not inject note when lowHistamine is false', async () => {
    await POST_BRIEF(makeBriefRequest({
      preferences: { lowHistamine: false },
    }))
    const prompt = capturedBriefPrompt()
    expect(prompt).not.toContain('low-histamine diet')
  })
})

// ─── drink-pairings — histamine-trigger beverage filtering ────────────────────

describe('drink-pairings — histamine filtering', () => {
  beforeEach(() => {
    // Mix: buttermilk (in BEVERAGE_KEYS + HIGH_HISTAMINE), green_tea (safe)
    mockRankSimilar.mockReturnValue([
      { name: 'buttermilk', score: 0.9 },
      { name: 'green_tea', score: 0.7 },
      { name: 'sparkling_water', score: 0.6 },
    ])
  })

  it('returns histamine-trigger beverages when lowHistamine is not set', async () => {
    const res = await POST_DRINK_PAIRINGS(makeDrinkPairingsRequest({
      ingredients: ['chicken'],
      allergens: [],
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { pairings: { drink: string }[] }
    const drinks = data.pairings.map((p) => p.drink)
    expect(drinks).toContain('buttermilk')
  })

  it('filters out histamine-trigger beverages when lowHistamine is true', async () => {
    const res = await POST_DRINK_PAIRINGS(makeDrinkPairingsRequest({
      ingredients: ['chicken'],
      allergens: [],
      lowHistamine: true,
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { pairings: { drink: string }[] }
    for (const pairing of data.pairings) {
      expect(HIGH_HISTAMINE_INGREDIENT_KEYS).not.toContain(pairing.drink)
    }
  })
})

// ─── substitutes — histamine key exclusion ────────────────────────────────────

describe('substitutes — histamine key exclusion', () => {
  it('includes miso and yogurt as candidates when lowHistamine is not set', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'chicken',
      context: [],
      allergens: [],
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { substitutes: { name: string }[] }
    const names = data.substitutes.map((s) => s.name)
    // At least one histamine trigger should appear without the filter
    expect(names.some((n) => ['soy_sauce', 'miso', 'yogurt', 'tempeh'].includes(n))).toBe(true)
  })

  it('excludes histamine-trigger candidates when lowHistamine is true', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'chicken',
      context: [],
      allergens: [],
      lowHistamine: true,
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { substitutes: { name: string }[] }
    const names = data.substitutes.map((s) => s.name)
    expect(names).not.toContain('soy_sauce')
    expect(names).not.toContain('miso')
    expect(names).not.toContain('yogurt')
    expect(names).not.toContain('tempeh')
  })

  it('still returns safe candidates when histamine keys are excluded', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'chicken',
      context: [],
      allergens: [],
      lowHistamine: true,
    }))
    expect(res.status).toBe(200)
    const data = await res.json() as { substitutes: { name: string }[] }
    const names = data.substitutes.map((s) => s.name)
    // tofu is safe
    expect(names).toContain('tofu')
  })
})

// ─── profile GET — lowHistamine returned ─────────────────────────────────────

describe('GET /api/user/profile — lowHistamine', () => {
  it('returns lowHistamine: true from stored item', async () => {
    mockSend.mockResolvedValue({
      Item: { userId: 'test-user-123', allergens: [], lowHistamine: true },
    })
    const res = await GET_PROFILE(makeProfileGetRequest('test-user-123'))
    const body = await res.json() as { lowHistamine?: boolean }
    expect(body.lowHistamine).toBe(true)
  })

  it('returns lowHistamine: false (or undefined) when absent from stored item', async () => {
    mockSend.mockResolvedValue({
      Item: { userId: 'test-user-123', allergens: [] },
    })
    const res = await GET_PROFILE(makeProfileGetRequest('test-user-123'))
    const body = await res.json() as { lowHistamine?: boolean }
    expect(body.lowHistamine === undefined || body.lowHistamine === false).toBe(true)
  })
})

// ─── profile PUT — lowHistamine written correctly ─────────────────────────────

describe('PUT /api/user/profile — lowHistamine', () => {
  it('saves lowHistamine: true to DynamoDB', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest({
      ...FULL_PUT_BODY,
      lowHistamine: true,
    }))
    const item = (mockSend.mock.calls[0][0] as { input: { Item: Record<string, unknown> } }).input.Item
    expect(item.lowHistamine).toBe(true)
  })

  it('defaults lowHistamine to false when absent from PUT body', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest(FULL_PUT_BODY))
    const item = (mockSend.mock.calls[0][0] as { input: { Item: Record<string, unknown> } }).input.Item
    expect(item.lowHistamine).toBe(false)
  })
})
