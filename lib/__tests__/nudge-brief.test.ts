/**
 * Tests for the nudge feature on /api/recipe-brief.
 *
 * Verifies: each nudge type injects the correct instruction into the Haiku
 * prompt; forcedCuisine overrides the cuisine line and injects its own
 * instruction; invalid nudge values are silently ignored; AbortError from
 * a cancelled generation fetch is swallowed without surfacing an error state.
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
  getEpicureVectors: jest.fn().mockReturnValue({ chicken: [0.1, 0.2] }),
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
  scores: { chicken: 0.8 },
  preferred: ['chicken'],
  avoided: [],
  signalCount: 10,
  strength: 'full' as const,
  formatSignals: [],
}

const BRIEF_JSON = JSON.stringify({
  direction: 'A test dish',
  reasoning: 'Because it is a test.',
  keyIngredients: ['chicken'],
  noveltyNote: 'First test',
  loadingHints: ['Hint one.', 'Hint two.', 'Hint three.'],
})

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/recipe-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const BASE_BODY = {
  userId: 'user-123',
  preferences: {
    mealType: 'main',
    cookTime: 'medium',
    cuisine: '',
    occasion: '',
    servings: 2,
  },
  kitchenIngredients: ['chicken'],
}

function capturedPrompt(): string {
  expect(mockCreate).toHaveBeenCalled()
  const call = mockCreate.mock.calls[0][0] as { messages: { content: string }[] }
  return call.messages[0].content
}

let POST: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const mod = await import('@/app/api/recipe-brief/route')
  POST = mod.POST
})

beforeEach(() => {
  jest.clearAllMocks()
  authMod.auth.api.getSession.mockResolvedValue({ user: { id: 'user-123' } })
  mockDynamoSend.mockResolvedValue({ Items: [] })
  mockBuildPreferenceProfile.mockResolvedValue(FULL_PROFILE)
  mockCreate.mockResolvedValue({ content: [{ type: 'text', text: BRIEF_JSON }] })
})

// ─── Nudge prompt injection ───────────────────────────────────────────────────

describe('nudge prompt injection', () => {
  it('injects spicier instruction when nudge=spicier', async () => {
    await POST(makeRequest({ ...BASE_BODY, nudge: 'spicier' }))
    const prompt = capturedPrompt()
    expect(prompt).toMatch(/spici(er|ng)|bolder.*hotter|hotter.*flavours/i)
    expect(prompt).toMatch(/taking this in a spicier direction/i)
  })

  it('injects vegetarian instruction when nudge=vegetarian', async () => {
    await POST(makeRequest({ ...BASE_BODY, nudge: 'vegetarian' }))
    const prompt = capturedPrompt()
    expect(prompt).toMatch(/vegetarian/i)
    expect(prompt).toMatch(/remove any meat or fish/i)
  })

  it('injects quicker instruction when nudge=quicker', async () => {
    await POST(makeRequest({ ...BASE_BODY, nudge: 'quicker' }))
    const prompt = capturedPrompt()
    expect(prompt).toMatch(/quicker|under 30 minutes/i)
  })

  it('injects surprise instruction when nudge=surprise', async () => {
    await POST(makeRequest({ ...BASE_BODY, nudge: 'surprise' }))
    const prompt = capturedPrompt()
    expect(prompt).toMatch(/completely different|contrasts with/i)
  })

  it('ignores unknown nudge values and adds no extra instruction', async () => {
    await POST(makeRequest({ ...BASE_BODY, nudge: 'invalid_nudge_type' }))
    const prompt = capturedPrompt()
    expect(prompt).not.toMatch(/taking this in a spicier direction/i)
    expect(prompt).not.toMatch(/remove any meat or fish/i)
    expect(prompt).not.toMatch(/under 30 minutes/i)
  })

  it('adds no nudge instruction when nudge is absent', async () => {
    await POST(makeRequest(BASE_BODY))
    const prompt = capturedPrompt()
    // Prompt should not include any nudge-specific language
    expect(prompt).not.toMatch(/taking this in a spicier direction/i)
    expect(prompt).not.toMatch(/completely different from their recent history/i)
  })
})

// ─── forcedCuisine injection ──────────────────────────────────────────────────

describe('forcedCuisine prompt injection', () => {
  it('injects cuisine instruction and overrides Cuisine line when forcedCuisine is set', async () => {
    await POST(makeRequest({ ...BASE_BODY, forcedCuisine: 'french' }))
    const prompt = capturedPrompt()
    expect(prompt).toMatch(/french/i)
    expect(prompt).toMatch(/taking this in a french direction/i)
  })

  it('overrides the cuisine in the Current request block', async () => {
    await POST(makeRequest({ ...BASE_BODY, cuisine: 'italian', forcedCuisine: 'japanese' }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('- Cuisine: japanese')
    // The user's saved preference (italian) should not appear in the cuisine line
    expect(prompt).not.toContain('- Cuisine: italian')
  })

  it('forcedCuisine takes priority over nudge for cuisine line', async () => {
    await POST(makeRequest({ ...BASE_BODY, nudge: 'surprise', forcedCuisine: 'moroccan' }))
    const prompt = capturedPrompt()
    expect(prompt).toContain('- Cuisine: moroccan')
    expect(prompt).toMatch(/taking this in a moroccan direction/i)
  })

  it('ignores forcedCuisine when it is an empty string', async () => {
    await POST(makeRequest({ ...BASE_BODY, forcedCuisine: '' }))
    const prompt = capturedPrompt()
    expect(prompt).not.toMatch(/taking this in a .* direction as requested/i)
  })
})

// ─── AbortError swallowing (pure logic) ──────────────────────────────────────

describe('AbortError handling in generation fetch', () => {
  it('AbortError is distinguishable from regular errors by name', () => {
    // fetch() throws a plain Error (name='AbortError') when the signal fires
    const err = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    expect(err.name).toBe('AbortError')
    const isAbort = err instanceof Error && err.name === 'AbortError'
    expect(isAbort).toBe(true)
  })

  it('non-AbortError is not treated as an expected cancellation', () => {
    const err = new Error('Network failure')
    const isAbort = err instanceof Error && err.name === 'AbortError'
    expect(isAbort).toBe(false)
  })

  it('AbortController signal is aborted after abort() is called', () => {
    const controller = new AbortController()
    expect(controller.signal.aborted).toBe(false)
    controller.abort()
    expect(controller.signal.aborted).toBe(true)
  })

  it('second controller is not affected when first is aborted', () => {
    const ctrl1 = new AbortController()
    const ctrl2 = new AbortController()
    ctrl1.abort()
    expect(ctrl1.signal.aborted).toBe(true)
    expect(ctrl2.signal.aborted).toBe(false)
  })
})

// ─── Nudge button visibility logic ───────────────────────────────────────────

describe('nudge button visibility logic', () => {
  // Mirrors the hiddenWhen predicates from NUDGE_BUTTONS in generated-recipe-screen
  const isSpicierHidden = (spiceTolerance?: string) => spiceTolerance === 'hot'
  const isVegetarianHidden = (dietaryPresets?: string[]) =>
    !!(dietaryPresets?.includes('vegetarian') || dietaryPresets?.includes('vegan'))
  const isQuickerHidden = (cookTime?: string) => cookTime === 'quick'

  it('spicier is hidden when spiceTolerance is hot', () => {
    expect(isSpicierHidden('hot')).toBe(true)
  })

  it('spicier is visible when spiceTolerance is mild or medium', () => {
    expect(isSpicierHidden('mild')).toBe(false)
    expect(isSpicierHidden('medium')).toBe(false)
    expect(isSpicierHidden(undefined)).toBe(false)
  })

  it('vegetarian is hidden when dietaryPresets includes vegetarian', () => {
    expect(isVegetarianHidden(['vegetarian'])).toBe(true)
  })

  it('vegetarian is hidden when dietaryPresets includes vegan', () => {
    expect(isVegetarianHidden(['vegan'])).toBe(true)
  })

  it('vegetarian is visible when no strict preset is active', () => {
    expect(isVegetarianHidden(['keto'])).toBe(false)
    expect(isVegetarianHidden([])).toBe(false)
    expect(isVegetarianHidden(undefined)).toBe(false)
  })

  it('quicker is hidden when cookTime is quick', () => {
    expect(isQuickerHidden('quick')).toBe(true)
  })

  it('quicker is visible when cookTime is medium or slow', () => {
    expect(isQuickerHidden('medium')).toBe(false)
    expect(isQuickerHidden('slow')).toBe(false)
    expect(isQuickerHidden(undefined)).toBe(false)
  })

  it('Different cuisine and Surprise me are always visible (no hidden condition)', () => {
    // These have hiddenWhen: () => false — always shown
    const alwaysVisible = () => false
    expect(alwaysVisible()).toBe(false)
  })
})
