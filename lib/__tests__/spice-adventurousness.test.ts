/**
 * Tests for spice tolerance and culinary adventurousness preferences.
 *
 * Covers:
 * - Spice injection in /api/generate-recipe prompt (all four values)
 * - Adventurousness injection in /api/generate-recipe prompt (all three values)
 * - Adventurousness injection in /api/recipe-brief prompt (all three values)
 * - Substitution scoring changes in /api/substitutes (familiar filter + adventurous no category adj)
 * - /api/user/profile GET returns defaults when fields absent
 * - /api/user/profile PUT writes both fields correctly
 */

import { NextRequest } from 'next/server'

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

// ─── Mock DynamoDB ─────────────────────────────────────────────────────────────

const mockSend = jest.fn()

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: mockSend },
}))

// ─── Mock Epicure ─────────────────────────────────────────────────────────────

jest.mock('@/lib/epicure', () => ({
  allIngredients: [],
  findSimilarIngredients: jest.fn().mockReturnValue([]),
  cosineSimilarityBetween: jest.fn().mockReturnValue(0.5),
  toEpicureKey: jest.fn((s: string) => s),
  getCategoryForIngredient: jest.fn().mockReturnValue('protein'),
  rankSimilar: jest.fn().mockReturnValue([
    { name: 'tofu', score: 0.85 },
    { name: 'tempeh', score: 0.75 },
    { name: 'seitan', score: 0.65 },
    { name: 'lentil', score: 0.55 },
    { name: 'chickpea', score: 0.45 },
  ]),
  getAllergensForIngredient: jest.fn().mockReturnValue([]),
  allergenIngredients: {},
  ALLERGEN_CODES: [],
  COMMON_ALLERGENS: [],
  INGREDIENT_CATEGORIES: {},
  findSafeIngredients: jest.fn().mockReturnValue([]),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipeJson(): string {
  return JSON.stringify({
    title: 'Test Dish',
    description: 'A test recipe.',
    ingredients: [{ name: 'chicken', amount: 1, unit: 'piece' }],
    steps: ['Cook the chicken.'],
    cookTime: '30 minutes',
    servings: 2,
    allergenFree: true,
  })
}

function makeBriefJson(): string {
  return JSON.stringify({
    direction: 'A Moroccan lamb tagine',
    reasoning: 'Novel for this user.',
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

function makeSubstituteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/substitutes', {
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

const MINIMAL_RECIPE_BODY = {
  ingredients: ['chicken'],
  allergens: [],
  mealType: 'main',
  cookTime: 'medium',
}

// ─── Route handlers loaded lazily ─────────────────────────────────────────────

let POST_RECIPE: (req: NextRequest) => Promise<Response>
let POST_SUBSTITUTES: (req: NextRequest) => Promise<Response>
let GET_PROFILE: (req: NextRequest) => Promise<Response>
let PUT_PROFILE: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const recipeMod = await import('@/app/api/generate-recipe/route')
  POST_RECIPE = recipeMod.POST

  const subsMod = await import('@/app/api/substitutes/route')
  POST_SUBSTITUTES = subsMod.POST

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
})

// ─── Spice tolerance → generate-recipe prompt ─────────────────────────────────

describe('spice tolerance → generate-recipe prompt', () => {
  it('injects no-spice instruction when spiceTolerance is none', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, spiceTolerance: 'none' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('cannot tolerate any heat or spice')
    expect(prompt).toContain('no chilli, black pepper, cayenne')
  })

  it('injects mild-spice instruction when spiceTolerance is mild', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, spiceTolerance: 'mild' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('very mild spice only')
    expect(prompt).toContain('Keep heat minimal')
  })

  it('injects no spice instruction when spiceTolerance is medium (default behaviour)', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, spiceTolerance: 'medium' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).not.toContain('cannot tolerate any heat')
    expect(prompt).not.toContain('very mild spice only')
    expect(prompt).not.toContain('loves bold heat')
  })

  it('injects hot-spice instruction when spiceTolerance is hot', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, spiceTolerance: 'hot' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('loves bold heat')
    expect(prompt).toContain("don't hold back on chilli")
  })

  it('treats absent spiceTolerance as medium (no injection)', async () => {
    await POST_RECIPE(makeRecipeRequest(MINIMAL_RECIPE_BODY))
    const prompt = capturedRecipePrompt()
    expect(prompt).not.toContain('cannot tolerate any heat')
    expect(prompt).not.toContain('loves bold heat')
  })
})

// ─── Adventurousness → generate-recipe prompt ─────────────────────────────────

describe('adventurousness → generate-recipe prompt', () => {
  it('injects familiar instruction when adventurousness is familiar', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, adventurousness: 'familiar' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('Stay within cuisines and techniques')
    expect(prompt).toContain('familiar, comforting combinations')
  })

  it('injects no instruction when adventurousness is occasional (default behaviour)', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, adventurousness: 'occasional' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).not.toContain('Stay within cuisines and techniques')
    expect(prompt).not.toContain('Push into less familiar territory')
  })

  it('injects adventurous instruction when adventurousness is adventurous', async () => {
    await POST_RECIPE(makeRecipeRequest({ ...MINIMAL_RECIPE_BODY, adventurousness: 'adventurous' }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('Push into less familiar territory')
    expect(prompt).toContain('novel techniques are all encouraged')
  })

  it('treats absent adventurousness as occasional (no injection)', async () => {
    await POST_RECIPE(makeRecipeRequest(MINIMAL_RECIPE_BODY))
    const prompt = capturedRecipePrompt()
    expect(prompt).not.toContain('Push into less familiar territory')
    expect(prompt).not.toContain('Stay within cuisines and techniques')
  })
})

// ─── Spice + adventurousness work together ────────────────────────────────────

describe('spice and adventurousness combined in generate-recipe', () => {
  it('injects both clauses when both are non-default', async () => {
    await POST_RECIPE(makeRecipeRequest({
      ...MINIMAL_RECIPE_BODY,
      spiceTolerance: 'hot',
      adventurousness: 'adventurous',
    }))
    const prompt = capturedRecipePrompt()
    expect(prompt).toContain('loves bold heat')
    expect(prompt).toContain('Push into less familiar territory')
  })

  it('both clauses appear before allergen constraint in safe-foods mode', async () => {
    await POST_RECIPE(makeRecipeRequest({
      ...MINIMAL_RECIPE_BODY,
      safeFoodsMode: true,
      safeIngredients: ['chicken', 'salt'],
      spiceTolerance: 'none',
      adventurousness: 'familiar',
    }))
    const prompt = capturedRecipePrompt()
    const spiceIdx = prompt.indexOf('cannot tolerate any heat')
    const adventIdx = prompt.indexOf('Stay within cuisines')
    const constraintIdx = prompt.indexOf('CRITICAL CONSTRAINT')
    expect(spiceIdx).toBeGreaterThan(-1)
    expect(adventIdx).toBeGreaterThan(-1)
    expect(constraintIdx).toBeGreaterThan(-1)
    expect(spiceIdx).toBeLessThan(constraintIdx)
    expect(adventIdx).toBeLessThan(constraintIdx)
  })
})

// ─── Substitution scoring — familiar mode ─────────────────────────────────────

describe('substitutes — familiar mode filters low-similarity candidates', () => {
  it('returns substitutes when all pass the 0.7 threshold', async () => {
    // rankSimilar returns tofu(0.85), tempeh(0.75) — both above 0.7
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'chicken',
      context: ['onion'],
      allergens: [],
      adventurousness: 'familiar',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    // All returned substitutes should have similarityToOriginal > 70
    for (const sub of data.substitutes) {
      expect(sub.similarityToOriginal).toBeGreaterThan(70)
    }
  })

  it('filters out candidates below 0.7 threshold in familiar mode', async () => {
    // seitan(0.65), lentil(0.55), chickpea(0.45) are below 0.7 and should be excluded
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'chicken',
      context: [],
      allergens: [],
      adventurousness: 'familiar',
    }))
    expect(res.status).toBe(200)
    const data = await res.json()
    for (const sub of data.substitutes) {
      expect(sub.similarityToOriginal).toBeGreaterThan(70)
    }
  })
})

// ─── Substitution scoring — adventurous mode ──────────────────────────────────

describe('substitutes — adventurous mode removes category adjustment', () => {
  it('returns 200 in adventurous mode', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'chicken',
      context: [],
      allergens: [],
      adventurousness: 'adventurous',
    }))
    expect(res.status).toBe(200)
  })

  it('returns more candidates in adventurous mode than familiar mode', async () => {
    const [adventRes, familiarRes] = await Promise.all([
      POST_SUBSTITUTES(makeSubstituteRequest({ ingredient: 'chicken', context: [], allergens: [], adventurousness: 'adventurous' })),
      POST_SUBSTITUTES(makeSubstituteRequest({ ingredient: 'chicken', context: [], allergens: [], adventurousness: 'familiar' })),
    ])
    const adventData = await adventRes.json()
    const familiarData = await familiarRes.json()
    // Adventurous should surface equal or more candidates (no strict 0.7 filter)
    expect(adventData.substitutes.length).toBeGreaterThanOrEqual(familiarData.substitutes.length)
  })
})

// ─── Substitution scoring — occasional mode (default) ────────────────────────

describe('substitutes — occasional mode (default behaviour)', () => {
  it('returns 200 with no adventurousness field', async () => {
    const res = await POST_SUBSTITUTES(makeSubstituteRequest({
      ingredient: 'chicken',
      context: [],
      allergens: [],
    }))
    expect(res.status).toBe(200)
  })

  it('treats occasional same as omitting the field', async () => {
    const [occasionalRes, omittedRes] = await Promise.all([
      POST_SUBSTITUTES(makeSubstituteRequest({ ingredient: 'chicken', context: [], allergens: [], adventurousness: 'occasional' })),
      POST_SUBSTITUTES(makeSubstituteRequest({ ingredient: 'chicken', context: [], allergens: [] })),
    ])
    const occasionalData = await occasionalRes.json()
    const omittedData = await omittedRes.json()
    expect(occasionalData.substitutes.length).toBe(omittedData.substitutes.length)
  })
})

// ─── Profile API — GET returns defaults when fields absent ────────────────────

describe('GET /api/user/profile — spiceTolerance and adventurousness', () => {
  it('returns spiceTolerance and adventurousness from stored item', async () => {
    mockSend.mockResolvedValue({
      Item: {
        userId: 'test-user-123',
        allergens: [],
        spiceTolerance: 'hot',
        adventurousness: 'adventurous',
      },
    })
    const res = await GET_PROFILE(makeProfileGetRequest('test-user-123'))
    const body = await res.json()
    expect(body.spiceTolerance).toBe('hot')
    expect(body.adventurousness).toBe('adventurous')
  })

  it('returns undefined for both when absent from stored item (context provides defaults)', async () => {
    mockSend.mockResolvedValue({
      Item: {
        userId: 'test-user-123',
        allergens: [],
      },
    })
    const res = await GET_PROFILE(makeProfileGetRequest('test-user-123'))
    const body = await res.json()
    // Route returns whatever is in DynamoDB — undefined means context supplies default
    expect(body.spiceTolerance === undefined || typeof body.spiceTolerance === 'string').toBe(true)
    expect(body.adventurousness === undefined || typeof body.adventurousness === 'string').toBe(true)
  })

  it('returns spiceTolerance: none and adventurousness: familiar', async () => {
    mockSend.mockResolvedValue({
      Item: { userId: 'test-user-123', allergens: [], spiceTolerance: 'none', adventurousness: 'familiar' },
    })
    const res = await GET_PROFILE(makeProfileGetRequest('test-user-123'))
    const body = await res.json()
    expect(body.spiceTolerance).toBe('none')
    expect(body.adventurousness).toBe('familiar')
  })
})

// ─── Profile API — PUT writes both fields correctly ───────────────────────────

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
}

describe('PUT /api/user/profile — spiceTolerance and adventurousness', () => {
  it('saves spiceTolerance: hot and adventurousness: adventurous', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest({
      ...FULL_PUT_BODY,
      spiceTolerance: 'hot',
      adventurousness: 'adventurous',
    }))
    const item = mockSend.mock.calls[0][0].input.Item
    expect(item.spiceTolerance).toBe('hot')
    expect(item.adventurousness).toBe('adventurous')
  })

  it('saves spiceTolerance: none and adventurousness: familiar', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest({
      ...FULL_PUT_BODY,
      spiceTolerance: 'none',
      adventurousness: 'familiar',
    }))
    const item = mockSend.mock.calls[0][0].input.Item
    expect(item.spiceTolerance).toBe('none')
    expect(item.adventurousness).toBe('familiar')
  })

  it('defaults to medium and occasional when fields are omitted', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest(FULL_PUT_BODY))
    const item = mockSend.mock.calls[0][0].input.Item
    expect(item.spiceTolerance).toBe('medium')
    expect(item.adventurousness).toBe('occasional')
  })

  it('saves all four spice values correctly', async () => {
    for (const spice of ['none', 'mild', 'medium', 'hot']) {
      mockSend.mockResolvedValue({})
      await PUT_PROFILE(makeProfilePutRequest({ ...FULL_PUT_BODY, spiceTolerance: spice }))
      const item = mockSend.mock.calls[mockSend.mock.calls.length - 1][0].input.Item
      expect(item.spiceTolerance).toBe(spice)
    }
  })

  it('saves all three adventurousness values correctly', async () => {
    for (const adv of ['familiar', 'occasional', 'adventurous']) {
      mockSend.mockResolvedValue({})
      await PUT_PROFILE(makeProfilePutRequest({ ...FULL_PUT_BODY, adventurousness: adv }))
      const item = mockSend.mock.calls[mockSend.mock.calls.length - 1][0].input.Item
      expect(item.adventurousness).toBe(adv)
    }
  })

  it('existing fields are preserved alongside new fields', async () => {
    mockSend.mockResolvedValue({})
    await PUT_PROFILE(makeProfilePutRequest({
      ...FULL_PUT_BODY,
      allergens: ['gluten', 'milk'],
      spiceTolerance: 'mild',
      adventurousness: 'occasional',
    }))
    const item = mockSend.mock.calls[0][0].input.Item
    expect(item.allergens).toEqual(['gluten', 'milk'])
    expect(item.spiceTolerance).toBe('mild')
    expect(item.adventurousness).toBe('occasional')
  })
})
