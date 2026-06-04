/**
 * Integration tests for the /api/generate-recipe route handler.
 *
 * Tests that cuisine, occasion, servings, and kitchen equipment are correctly
 * injected into the Claude prompt. The Anthropic SDK is mocked so no real API
 * calls are made; what we assert is the *content* sent to Claude.
 */

import { NextRequest } from 'next/server'

// ─── Clerk mock ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const clerkServer = require('@clerk/nextjs/server') as { auth: jest.MockedFunction<() => Promise<{ userId: string | null }>> }

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────────

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

// ─── Mock DynamoDB (feedback query — returns empty, no userId in test bodies) ─

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: jest.fn().mockResolvedValue({ Items: [] }) },
}))

// ─── Mock Epicure (auto-swap — not exercised when feedback is empty) ──────────

jest.mock('@/lib/epicure', () => ({
  allIngredients: [],
  findSimilarIngredients: jest.fn().mockReturnValue([]),
  cosineSimilarityBetween: jest.fn().mockReturnValue(0),
  toEpicureKey: jest.fn((s: string) => s),
  getCategoryForIngredient: jest.fn().mockReturnValue(null),
  rankSimilar: jest.fn().mockReturnValue([]),
  getAllergensForIngredient: jest.fn().mockReturnValue([]),
  allergenIngredients: {},
  ALLERGEN_CODES: [],
  COMMON_ALLERGENS: [],
  INGREDIENT_CATEGORIES: {},
  findSafeIngredients: jest.fn().mockReturnValue([]),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipeJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    title: 'Test Dish',
    description: 'A test recipe.',
    ingredients: [{ name: 'chicken', amount: 1, unit: 'piece' }],
    steps: ['Cook the chicken.'],
    cookTime: '30 minutes',
    servings: 2,
    allergenFree: true,
    ...overrides,
  })
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/generate-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function capturedPrompt(): string {
  expect(mockCreate).toHaveBeenCalled()
  const call = mockCreate.mock.calls[0][0]
  return call.messages[0].content as string
}

const MINIMAL_BODY = {
  ingredients: ['chicken'],
  allergens: [],
  mealType: 'main',
  cookTime: 'medium',
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let POST: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const mod = await import('@/app/api/generate-recipe/route')
  POST = mod.POST
})

beforeEach(() => {
  jest.clearAllMocks()
  clerkServer.auth.mockResolvedValue({ userId: 'test-user-123' })
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: makeRecipeJson() }],
  })
})

// ─── Cuisine filter ───────────────────────────────────────────────────────────

describe('cuisine filter → Claude prompt', () => {
  it('omits a cuisine clause when cuisine is empty', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, cuisine: '' }))
    expect(capturedPrompt()).not.toContain('inspired dish')
  })

  it('injects "italian-inspired" when cuisine is italian', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, cuisine: 'italian' }))
    expect(capturedPrompt()).toContain('italian-inspired')
  })

  it('injects "thai-inspired" when cuisine is thai', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, cuisine: 'thai' }))
    expect(capturedPrompt()).toContain('thai-inspired')
  })

  it('injects the "surprise me" adventurous clause', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, cuisine: 'surprise' }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('cuisine of your choice')
    expect(prompt).toContain('adventurous')
    expect(prompt).not.toContain('surprise-inspired')
  })

  it('omits cuisine clause when cuisine key is absent from body', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    expect(capturedPrompt()).not.toContain('inspired dish')
  })
})

// ─── Occasion filter ─────────────────────────────────────────────────────────

describe('occasion filter → Claude prompt', () => {
  it('omits an occasion clause when occasion is empty', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, occasion: '' }))
    expect(capturedPrompt()).not.toContain('This is for')
  })

  it('injects "This is for Weeknight" when occasion is Weeknight', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, occasion: 'Weeknight' }))
    expect(capturedPrompt()).toContain('This is for Weeknight')
  })

  it('injects "This is for Dinner Party" correctly', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, occasion: 'Dinner Party' }))
    expect(capturedPrompt()).toContain('This is for Dinner Party')
  })

  it('injects "This is for Romantic Dinner" correctly', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, occasion: 'Romantic Dinner' }))
    expect(capturedPrompt()).toContain('This is for Romantic Dinner')
  })

  it('omits occasion clause when occasion key is absent from body', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    expect(capturedPrompt()).not.toContain('This is for')
  })
})

// ─── Servings filter ──────────────────────────────────────────────────────────

describe('servings filter → Claude prompt', () => {
  it('always injects a servings clause (default 2)', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    expect(capturedPrompt()).toContain('Recipe should serve 2 people')
  })

  it('uses "person" for servings=1', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, servings: 1 }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('1 person')
    expect(prompt).not.toContain('1 people')
  })

  it('uses "people" for servings=4', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, servings: 4 }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('4 people')
    expect(prompt).not.toContain('4 person,')
  })

  it('instructs Claude to scale quantities', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, servings: 6 }))
    expect(capturedPrompt()).toContain('scale quantities accordingly')
  })

  it('handles servings=12 (max)', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, servings: 12 }))
    expect(capturedPrompt()).toContain('12 people')
  })

  it('falls back to 2 when servings is not a number', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, servings: 'lots' }))
    expect(capturedPrompt()).toContain('Recipe should serve 2 people')
  })
})

// ─── Kitchen equipment filter ─────────────────────────────────────────────────

describe('kitchen equipment filter → Claude prompt', () => {
  it('omits equipment clause when kitchenEquipment is empty array', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, kitchenEquipment: [] }))
    expect(capturedPrompt()).not.toContain('compatible with')
  })

  it('injects equipment clause when hob + oven are passed', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, kitchenEquipment: ['hob', 'oven'] }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('compatible with')
    expect(prompt).toContain('hob')
    expect(prompt).toContain('oven')
  })

  it('includes the restriction against unlisted equipment', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, kitchenEquipment: ['hob'] }))
    expect(capturedPrompt()).toContain('Do not suggest methods requiring equipment not in this list')
  })

  it('includes all equipment items when all 8 are provided', async () => {
    const all = ['hob', 'oven', 'microwave', 'air_fryer', 'slow_cooker', 'pizza_oven', 'barbecue', 'instant_pot']
    await POST(makeRequest({ ...MINIMAL_BODY, kitchenEquipment: all }))
    const prompt = capturedPrompt()
    for (const item of all) {
      expect(prompt).toContain(item)
    }
  })

  it('omits equipment clause when kitchenEquipment key is absent', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    expect(capturedPrompt()).not.toContain('compatible with')
  })
})

// ─── All four filters together ────────────────────────────────────────────────

describe('all four filters combined', () => {
  it('includes all four clauses when all filters are set', async () => {
    await POST(makeRequest({
      ...MINIMAL_BODY,
      cuisine: 'japanese',
      occasion: 'Celebration',
      servings: 8,
      kitchenEquipment: ['hob', 'oven'],
    }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('japanese-inspired')
    expect(prompt).toContain('This is for Celebration')
    expect(prompt).toContain('8 people')
    expect(prompt).toContain('hob')
    expect(prompt).toContain('oven')
  })

  it('filters work correctly in safe-foods mode', async () => {
    await POST(makeRequest({
      ...MINIMAL_BODY,
      safeFoodsMode: true,
      safeIngredients: ['chicken', 'salt'],
      cuisine: 'moroccan',
      occasion: 'Meal Prep',
      servings: 5,
      kitchenEquipment: ['slow_cooker'],
    }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('moroccan-inspired')
    expect(prompt).toContain('This is for Meal Prep')
    expect(prompt).toContain('5 people')
    expect(prompt).toContain('slow_cooker')
    // Safe foods critical constraint must still be present
    expect(prompt).toContain('CRITICAL CONSTRAINT')
  })
})

// ─── Response passthrough ─────────────────────────────────────────────────────

describe('response handling', () => {
  it('returns 200 with the parsed recipe JSON', async () => {
    const res = await POST(makeRequest({ ...MINIMAL_BODY, cuisine: 'greek', servings: 3 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Test Dish')
    expect(body.allergenFree).toBe(true)
  })

  it('returns 400 for an invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/generate-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
