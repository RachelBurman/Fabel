/**
 * Tests for recipeBrief injection in /api/generate-recipe.
 *
 * Verifies: brief direction included in prompt when present, behaviour unchanged
 * when recipeBrief is absent, and direction not injected when direction is null.
 */

import { NextRequest } from 'next/server'

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────────

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

// ─── Mock DynamoDB ────────────────────────────────────────────────────────────

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: jest.fn().mockResolvedValue({ Items: [] }) },
}))

// ─── Mock Epicure ─────────────────────────────────────────────────────────────

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
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: makeRecipeJson() }],
  })
})

// ─── Brief injection ──────────────────────────────────────────────────────────

describe('recipeBrief → Claude prompt injection', () => {
  it('includes brief direction in the prompt when recipeBrief.direction is present', async () => {
    await POST(makeRequest({
      ...MINIMAL_BODY,
      recipeBrief: {
        direction: 'A slow-cooked Moroccan lamb tagine',
        keyIngredients: ['lamb', 'preserved lemon'],
      },
    }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('A slow-cooked Moroccan lamb tagine')
    expect(prompt).toContain('Recipe direction from taste analysis')
  })

  it('includes key ingredients in the prompt when present', async () => {
    await POST(makeRequest({
      ...MINIMAL_BODY,
      recipeBrief: {
        direction: 'A Korean bibimbap',
        keyIngredients: ['gochujang', 'sesame oil', 'rice'],
      },
    }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('gochujang')
    expect(prompt).toContain('sesame oil')
    expect(prompt).toContain('rice')
    expect(prompt).toContain('Key ingredients to incorporate')
  })

  it('includes the novelty framing sentence in the prompt', async () => {
    await POST(makeRequest({
      ...MINIMAL_BODY,
      recipeBrief: {
        direction: 'A Thai green curry',
        keyIngredients: ['lemongrass'],
      },
    }))
    const prompt = capturedPrompt()
    expect(prompt).toContain("novel territory for this user")
  })
})

// ─── No injection when recipeBrief is absent ──────────────────────────────────

describe('no brief injection when recipeBrief is absent', () => {
  it('behaves identically when recipeBrief is not in the body', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    const prompt = capturedPrompt()
    expect(prompt).not.toContain('Recipe direction from taste analysis')
    expect(prompt).not.toContain('novel territory')
  })

  it('does not inject brief when recipeBrief.direction is null', async () => {
    await POST(makeRequest({
      ...MINIMAL_BODY,
      recipeBrief: { direction: null, keyIngredients: ['lamb'] },
    }))
    const prompt = capturedPrompt()
    expect(prompt).not.toContain('Recipe direction from taste analysis')
  })

  it('does not inject brief when recipeBrief.direction is an empty string', async () => {
    await POST(makeRequest({
      ...MINIMAL_BODY,
      recipeBrief: { direction: '', keyIngredients: [] },
    }))
    const prompt = capturedPrompt()
    expect(prompt).not.toContain('Recipe direction from taste analysis')
  })

  it('still returns a valid recipe when recipeBrief is absent', async () => {
    const res = await POST(makeRequest(MINIMAL_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Test Dish')
  })
})

// ─── Brief injection in safe-foods mode ──────────────────────────────────────

describe('brief injection works alongside safe-foods mode', () => {
  it('injects brief direction even when safeFoodsMode is true', async () => {
    await POST(makeRequest({
      ...MINIMAL_BODY,
      safeFoodsMode: true,
      safeIngredients: ['chicken', 'salt'],
      recipeBrief: {
        direction: 'A simple Japanese miso broth',
        keyIngredients: ['miso'],
      },
    }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('A simple Japanese miso broth')
    expect(prompt).toContain('CRITICAL CONSTRAINT')
  })
})
