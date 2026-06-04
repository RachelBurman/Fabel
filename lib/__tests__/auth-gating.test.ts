/**
 * Tests for auth-gating across API routes and the requireAuth helper.
 *
 * Verifies: requireAuth throws/returns correctly, generate-recipe guest mode,
 * scan-ingredients 401, macros 401, recipe-brief 401, substitutes no
 * explanation for guests, drink-pairings open to all, findFallbackRecipe
 * called with correct allergen params for guest generate-recipe.
 */

import { NextRequest } from 'next/server'

// ─── Clerk mock ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const clerkServer = require('@clerk/nextjs/server') as {
  auth: jest.MockedFunction<() => Promise<{ userId: string | null }>>
}

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

// ─── Mock rate limiter ────────────────────────────────────────────────────────

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  incrementRateLimit: jest.fn().mockResolvedValue(undefined),
}))

// ─── Mock community-recipe-fallback ──────────────────────────────────────────

const mockFindFallbackRecipe = jest.fn()

jest.mock('@/lib/community-recipe-fallback', () => ({
  findFallbackRecipe: (...args: unknown[]) => mockFindFallbackRecipe(...args),
}))

// ─── Mock Epicure (used by substitutes) ──────────────────────────────────────

jest.mock('@/lib/epicure', () => ({
  rankSimilar: jest.fn().mockReturnValue([
    { name: 'olive_oil', score: 0.9 },
    { name: 'coconut_oil', score: 0.8 },
    { name: 'sunflower_oil', score: 0.7 },
  ]),
  getAllergensForIngredient: jest.fn().mockReturnValue([]),
  cosineSimilarityBetween: jest.fn().mockReturnValue(0.5),
  toEpicureKey: jest.fn((k: string) => k.toLowerCase().replace(/\s+/g, '_')),
  getCategoryForIngredient: jest.fn().mockReturnValue('fat'),
  getEpicureVectors: jest.fn().mockReturnValue({}),
  findSimilarIngredients: jest.fn().mockReturnValue([]),
}))

// ─── Mock preference-profile + related (used by generate-recipe) ─────────────

jest.mock('@/lib/preference-profile', () => ({
  buildPreferenceProfile: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/feedback-preferences', () => ({
  buildTasteProfileClause: jest.fn().mockReturnValue(''),
}))

jest.mock('@/lib/survey-signals', () => ({
  formatSignalsToClauses: jest.fn().mockReturnValue([]),
}))

jest.mock('@/lib/safe-foods', () => ({
  buildSafeSet: jest.fn().mockReturnValue(new Set()),
  findInSafeSet: jest.fn().mockReturnValue([]),
  validateSafeFoods: jest.fn((r: unknown) => ({ recipe: r, violations: [] })),
  LIQUID_TERMS: [],
  SALT_TERMS: [],
}))

jest.mock('@/lib/shelf-life', () => ({
  getShelfLifeDays: jest.fn().mockReturnValue(7),
  addDays: jest.fn((d: string) => d),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, url = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const FAKE_RECIPE = {
  title: 'Community Pasta',
  description: 'A simple pasta dish.',
  ingredients: [{ name: 'pasta', amount: 200, unit: 'g' }],
  steps: ['Cook pasta.'],
  cookTime: '20 minutes',
  servings: 2,
  allergenFree: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  clerkServer.auth.mockResolvedValue({ userId: null })
  mockFindFallbackRecipe.mockResolvedValue(FAKE_RECIPE)
})

// ─── requireAuth ─────────────────────────────────────────────────────────────

describe('requireAuth()', () => {
  it('throws AuthRequiredError when no Clerk session', async () => {
    const { requireAuth, AuthRequiredError } = await import('../get-user-id')
    clerkServer.auth.mockResolvedValue({ userId: null })
    await expect(requireAuth()).rejects.toBeInstanceOf(AuthRequiredError)
  })

  it('returns userId when authenticated', async () => {
    const { requireAuth } = await import('../get-user-id')
    clerkServer.auth.mockResolvedValue({ userId: 'user_abc' })
    const result = await requireAuth()
    expect(result).toEqual({ userId: 'user_abc' })
  })
})

// ─── /api/scan-ingredients ────────────────────────────────────────────────────

describe('POST /api/scan-ingredients', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const { POST } = await import('../../app/api/scan-ingredients/route')
    const res = await POST(makeRequest({ image: 'base64data', mediaType: 'image/jpeg' }))
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('auth_required')
  })
})

// ─── /api/macros ─────────────────────────────────────────────────────────────

describe('POST /api/macros', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const { POST } = await import('../../app/api/macros/route')
    const res = await POST(makeRequest({ title: 'Pasta', ingredients: [], servings: 2 }))
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('auth_required')
  })
})

// ─── /api/recipe-brief ───────────────────────────────────────────────────────

describe('POST /api/recipe-brief', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const { POST } = await import('../../app/api/recipe-brief/route')
    const res = await POST(makeRequest({ userId: 'guest-uuid' }))
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('auth_required')
  })
})

// ─── /api/generate-recipe ────────────────────────────────────────────────────

describe('POST /api/generate-recipe', () => {
  it('returns guestMode:true + DB recipe without calling Claude', async () => {
    // Guest: auth returns null
    const { POST } = await import('../../app/api/generate-recipe/route')
    const res = await POST(makeRequest({
      ingredients: [{ name: 'pasta' }],
      allergens: [],
      userId: 'guest-uuid-123',
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { guestMode: boolean; recipe: unknown }
    expect(body.guestMode).toBe(true)
    expect(body.recipe).toMatchObject({ title: 'Community Pasta' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('skips rate limit check for guest requests', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limiter')
    const { POST } = await import('../../app/api/generate-recipe/route')
    await POST(makeRequest({ ingredients: [], allergens: [], userId: 'guest-uuid' }))
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  it('calls findFallbackRecipe with correct allergen params', async () => {
    const { POST } = await import('../../app/api/generate-recipe/route')
    await POST(makeRequest({
      ingredients: [],
      allergens: ['gluten', 'milk'],
      mealType: 'main',
      cuisine: 'italian',
      userId: 'guest-uuid',
    }))
    expect(mockFindFallbackRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        allergens: ['gluten', 'milk'],
        mealType: 'main',
        cuisine: 'italian',
      })
    )
  })
})

// ─── /api/substitutes ────────────────────────────────────────────────────────

describe('POST /api/substitutes', () => {
  it('returns matches without explanation field for guest', async () => {
    // Guest: no Claude call, explanations remain null
    const { POST } = await import('../../app/api/substitutes/route')
    const res = await POST(makeRequest({
      ingredient: 'butter',
      context: ['pasta', 'garlic'],
      allergens: [],
      userId: 'guest-uuid',
    }))
    expect(res.status).toBe(200)
    const body = await res.json() as { substitutes: Array<{ explanation: null }> }
    expect(body.substitutes.length).toBeGreaterThan(0)
    body.substitutes.forEach((sub) => {
      expect(sub.explanation).toBeNull()
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

// ─── /api/drink-pairings ─────────────────────────────────────────────────────

describe('POST /api/drink-pairings', () => {
  it('returns results without requiring authentication', async () => {
    // drink-pairings is fully open — no auth needed
    jest.mock('@/lib/epicure', () => ({
      ...jest.requireMock('@/lib/epicure'),
      getBeveragePairings: jest.fn().mockReturnValue([
        { name: 'red_wine', score: 0.85 },
      ]),
    }))
    const { POST } = await import('../../app/api/drink-pairings/route')
    const res = await POST(makeRequest({ ingredients: ['pasta', 'tomato'], allergens: [] }))
    // Should not return 401
    expect(res.status).not.toBe(401)
  })
})
