/**
 * Tests for the /api/recipe-brief route handler.
 *
 * Verifies: guest brief returned when userId is null, guest brief returned when
 * buildPreferenceProfile returns null, correct model is used (Haiku not Sonnet),
 * valid RecipeBrief shape on happy path, fallback to guest brief on Claude error,
 * fallback to guest brief on invalid JSON from Claude, and that Claude is never
 * called when userId is null.
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

// ─── Mock DynamoDB ────────────────────────────────────────────────────────────

const mockDynamoSend = jest.fn()

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: mockDynamoSend },
}))

// ─── Mock buildPreferenceProfile ──────────────────────────────────────────────

const mockBuildPreferenceProfile = jest.fn()

jest.mock('@/lib/preference-profile', () => ({
  buildPreferenceProfile: (...args: unknown[]) => mockBuildPreferenceProfile(...args),
}))

// ─── Mock Epicure ─────────────────────────────────────────────────────────────

jest.mock('@/lib/epicure', () => ({
  getEpicureVectors: jest.fn().mockReturnValue({ chicken: [0.1, 0.2], tomato: [0.3, 0.4] }),
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

// ─── Mock deriveFlavourTerritory ──────────────────────────────────────────────

jest.mock('@/lib/flavour-territory', () => ({
  deriveFlavourTerritory: jest.fn().mockReturnValue(['cumin', 'paprika']),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FULL_PROFILE = {
  scores: { chicken: 0.8, tomato: 0.6 },
  preferred: ['chicken', 'tomato'],
  avoided: ['fish'],
  signalCount: 15,
  strength: 'full' as const,
  formatSignals: [],
}

const BRIEF_JSON = JSON.stringify({
  direction: 'A slow-cooked Moroccan lamb tagine',
  reasoning: 'You love cumin — you have never gone North African. Let\'s fix that.',
  keyIngredients: ['lamb', 'preserved lemon', 'ras el hanout', 'chickpeas'],
  noveltyNote: 'First time in North African territory',
  loadingHints: ['Preserved lemon transforms when slow-cooked.', 'Tagine means both dish and vessel.', 'Ras el hanout means "top of the shop".'],
})

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/recipe-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const MINIMAL_BODY = {
  userId: 'user-123',
  preferences: {
    mealType: 'main',
    cookTime: 'medium',
    cuisine: '',
    occasion: '',
    servings: 2,
    equipment: [],
    useKitchenOnly: false,
  },
  kitchenIngredients: ['chicken', 'tomato'],
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let POST: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const mod = await import('@/app/api/recipe-brief/route')
  POST = mod.POST
})

beforeEach(() => {
  jest.clearAllMocks()
  clerkServer.auth.mockResolvedValue({ userId: 'user-123' })
  mockDynamoSend.mockResolvedValue({ Items: [
    { recipeTitle: 'Chicken Stir Fry', liked: true, timestamp: '2026-06-01T10:00:00Z' },
    { recipeTitle: 'Tomato Pasta', liked: false, timestamp: '2026-06-02T10:00:00Z' },
  ] })
  mockBuildPreferenceProfile.mockResolvedValue(FULL_PROFILE)
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: BRIEF_JSON }],
  })
})

// ─── Guest (unauthenticated) — returns 401 ───────────────────────────────────

describe('unauthenticated request', () => {
  beforeEach(() => {
    clerkServer.auth.mockResolvedValue({ userId: null })
  })

  it('returns 401 auth_required when no Clerk session', async () => {
    const res = await POST(makeRequest(MINIMAL_BODY))
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('auth_required')
  })

  it('does not call Claude when unauthenticated', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('does not call buildPreferenceProfile when unauthenticated', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    expect(mockBuildPreferenceProfile).not.toHaveBeenCalled()
  })
})

// ─── Fallback brief — authenticated but no history ────────────────────────────

describe('guest brief — insufficient history', () => {
  it('returns guest brief when buildPreferenceProfile returns null', async () => {
    mockBuildPreferenceProfile.mockResolvedValue(null)
    const res = await POST(makeRequest(MINIMAL_BODY))
    const { brief } = await res.json()
    expect(brief.direction).toBeNull()
    expect(brief.loadingHints.length).toBeGreaterThan(0)
  })

  it('does not call Claude when buildPreferenceProfile returns null', async () => {
    mockBuildPreferenceProfile.mockResolvedValue(null)
    await POST(makeRequest(MINIMAL_BODY))
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

// ─── Model selection ──────────────────────────────────────────────────────────

describe('model selection', () => {
  it('calls Claude Haiku 4.5 (not Sonnet) for the reasoning call', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' })
    )
  })

  it('never calls claude-sonnet-4-6', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    const call = mockCreate.mock.calls[0]?.[0]
    expect(call?.model).not.toContain('sonnet')
  })
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('happy path', () => {
  it('returns a valid RecipeBrief shape when profile exists', async () => {
    const res = await POST(makeRequest(MINIMAL_BODY))
    expect(res.status).toBe(200)
    const { brief } = await res.json()
    expect(typeof brief.direction).toBe('string')
    expect(typeof brief.reasoning).toBe('string')
    expect(Array.isArray(brief.keyIngredients)).toBe(true)
    expect(typeof brief.noveltyNote).toBe('string')
    expect(Array.isArray(brief.loadingHints)).toBe(true)
    expect(brief.loadingHints.length).toBe(3)
  })

  it('passes the user taste profile to Claude in the user message', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    const call = mockCreate.mock.calls[0][0]
    const userContent: string = call.messages[0].content
    expect(userContent).toContain('chicken')
    expect(userContent).toContain('Taste profile')
  })

  it('includes the kitchen ingredients in the Claude user message', async () => {
    await POST(makeRequest({ ...MINIMAL_BODY, kitchenIngredients: ['aubergine', 'miso'] }))
    const call = mockCreate.mock.calls[0][0]
    const userContent: string = call.messages[0].content
    expect(userContent).toContain('aubergine')
    expect(userContent).toContain('miso')
  })

  it('caches the system prompt with ephemeral cache_control', async () => {
    await POST(makeRequest(MINIMAL_BODY))
    const call = mockCreate.mock.calls[0][0]
    const systemBlock = call.system[0]
    expect(systemBlock.cache_control).toEqual({ type: 'ephemeral' })
  })
})

// ─── Error fallbacks ──────────────────────────────────────────────────────────

describe('error fallbacks', () => {
  it('falls back to guest brief if Claude call throws', async () => {
    mockCreate.mockRejectedValue(new Error('Claude is down'))
    const res = await POST(makeRequest(MINIMAL_BODY))
    expect(res.status).toBe(200)
    const { brief } = await res.json()
    expect(brief.direction).toBeNull()
    expect(brief.loadingHints.length).toBeGreaterThan(0)
  })

  it('falls back to guest brief if Claude returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json at all {{{' }],
    })
    const res = await POST(makeRequest(MINIMAL_BODY))
    const { brief } = await res.json()
    expect(brief.direction).toBeNull()
  })

  it('falls back to guest brief if Claude returns no text block', async () => {
    mockCreate.mockResolvedValue({ content: [] })
    const res = await POST(makeRequest(MINIMAL_BODY))
    const { brief } = await res.json()
    expect(brief.direction).toBeNull()
  })

  it('falls back to guest brief if DynamoDB throws', async () => {
    mockDynamoSend.mockRejectedValue(new Error('DynamoDB unavailable'))
    const res = await POST(makeRequest(MINIMAL_BODY))
    const { brief } = await res.json()
    expect(brief.direction).toBeNull()
    expect(brief.loadingHints.length).toBeGreaterThan(0)
  })

  it('returns 200 (not 500) in all fallback cases', async () => {
    mockCreate.mockRejectedValue(new Error('any error'))
    const res = await POST(makeRequest(MINIMAL_BODY))
    expect(res.status).toBe(200)
  })
})

// ─── JSON extraction ──────────────────────────────────────────────────────────

describe('JSON extraction', () => {
  it('strips markdown code fences from Claude response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + BRIEF_JSON + '\n```' }],
    })
    const res = await POST(makeRequest(MINIMAL_BODY))
    const { brief } = await res.json()
    expect(brief.direction).toBe('A slow-cooked Moroccan lamb tagine')
  })
})
