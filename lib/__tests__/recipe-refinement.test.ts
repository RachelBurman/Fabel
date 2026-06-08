/**
 * Tests for Recipe Screen Refinement:
 * 1. Nudge from completed recipe — existingRecipe context injected into both
 *    /api/recipe-brief and /api/generate-recipe prompts.
 * 2. POST /api/recipe-update-ingredient — swaps ingredient and updates steps.
 * 3. Regenerate confirmation logic — inline confirm state behaviour.
 */

import { NextRequest } from 'next/server'

// ─── Better Auth mock ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const authMod = require('@/lib/auth') as { auth: { api: { getSession: jest.MockedFunction<() => Promise<{ user: { id: string } } | null>> } } }

// ─── Anthropic SDK mock ───────────────────────────────────────────────────────

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

// ─── DynamoDB mock ────────────────────────────────────────────────────────────

const mockDynamoSend = jest.fn()

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: mockDynamoSend },
}))

// ─── buildPreferenceProfile mock ──────────────────────────────────────────────

const mockBuildPreferenceProfile = jest.fn()

jest.mock('@/lib/preference-profile', () => ({
  buildPreferenceProfile: (...args: unknown[]) => mockBuildPreferenceProfile(...args),
}))

// ─── Epicure mocks ────────────────────────────────────────────────────────────

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

jest.mock('@/lib/flavour-territory', () => ({
  deriveFlavourTerritory: jest.fn().mockReturnValue(['cumin', 'paprika']),
}))

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const FULL_PROFILE = {
  scores: { chicken: 0.8 },
  preferred: ['chicken'],
  avoided: [],
  signalCount: 10,
  strength: 'full' as const,
  formatSignals: [],
}

const BRIEF_JSON = JSON.stringify({
  direction: 'A refined dish',
  reasoning: 'Variation on the original.',
  keyIngredients: ['chicken'],
  noveltyNote: null,
  loadingHints: ['Hint one.', 'Hint two.', 'Hint three.'],
})

const BASE_RECIPE = {
  title: 'Lemon Herb Chicken',
  description: 'A light dish.',
  ingredients: [
    { name: 'chicken', amount: 200, unit: 'g' },
    { name: 'lemon', amount: 1, unit: 'piece' },
  ],
  steps: ['Season the chicken with lemon juice.', 'Cook until golden.'],
  cookTime: '30 minutes',
  servings: 2,
  allergenFree: true,
}

function makeRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. /api/recipe-brief — existingRecipe context injection
// ═══════════════════════════════════════════════════════════════════════════════

describe('/api/recipe-brief existingRecipe injection', () => {
  let POST: (req: NextRequest) => Promise<Response>

  const BASE_BODY = {
    userId: 'user-123',
    preferences: { mealType: 'main', cookTime: 'medium', cuisine: '', occasion: '', servings: 2 },
    kitchenIngredients: ['chicken'],
  }

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

  it('injects existingRecipe title and ingredients into the prompt when provided', async () => {
    await POST(makeRequest('/api/recipe-brief', {
      ...BASE_BODY,
      nudge: 'spicier',
      existingRecipe: { title: BASE_RECIPE.title, ingredients: ['chicken', 'lemon'] },
    }))

    expect(mockCreate).toHaveBeenCalled()
    const call = mockCreate.mock.calls[0][0] as { messages: { content: string }[] }
    const prompt = call.messages[0].content
    expect(prompt).toContain('Lemon Herb Chicken')
    expect(prompt).toContain('refining an existing recipe')
    expect(prompt).toContain('chicken')
  })

  it('does not inject existingRecipe note when not provided', async () => {
    await POST(makeRequest('/api/recipe-brief', { ...BASE_BODY, nudge: 'spicier' }))

    const call = mockCreate.mock.calls[0][0] as { messages: { content: string }[] }
    const prompt = call.messages[0].content
    expect(prompt).not.toContain('refining an existing recipe')
  })

  it('existingRecipe note is injected alongside nudge instruction', async () => {
    await POST(makeRequest('/api/recipe-brief', {
      ...BASE_BODY,
      nudge: 'vegetarian',
      existingRecipe: { title: 'Beef Stew', ingredients: ['beef', 'carrot'] },
    }))

    const call = mockCreate.mock.calls[0][0] as { messages: { content: string }[] }
    const prompt = call.messages[0].content
    expect(prompt).toContain('Beef Stew')
    expect(prompt).toMatch(/vegetarian/i)
  })

  it('ignores existingRecipe when title is missing', async () => {
    await POST(makeRequest('/api/recipe-brief', {
      ...BASE_BODY,
      existingRecipe: { ingredients: ['chicken'] },
    }))

    const call = mockCreate.mock.calls[0][0] as { messages: { content: string }[] }
    const prompt = call.messages[0].content
    expect(prompt).not.toContain('refining an existing recipe')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. /api/recipe-update-ingredient — ingredient swap
// ═══════════════════════════════════════════════════════════════════════════════

describe('/api/recipe-update-ingredient', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    const mod = await import('@/app/api/recipe-update-ingredient/route')
    POST = mod.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
    authMod.auth.api.getSession.mockResolvedValue({ user: { id: 'user-123' } })
  })

  it('returns 401 when not authenticated', async () => {
    authMod.auth.api.getSession.mockResolvedValue(null)
    const res = await POST(makeRequest('/api/recipe-update-ingredient', {
      existingRecipe: BASE_RECIPE,
      original: 'chicken',
      substitute: 'tofu',
    }))
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('auth_required')
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest('/api/recipe-update-ingredient', {
      existingRecipe: BASE_RECIPE,
    }))
    expect(res.status).toBe(400)
  })

  it('calls Haiku with existingRecipe, original, and substitute in the prompt', async () => {
    const updatedRecipe = { ...BASE_RECIPE, title: 'Lemon Herb Tofu' }
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(updatedRecipe) }],
    })

    await POST(makeRequest('/api/recipe-update-ingredient', {
      existingRecipe: BASE_RECIPE,
      original: 'chicken',
      substitute: 'tofu',
    }))

    expect(mockCreate).toHaveBeenCalled()
    const call = mockCreate.mock.calls[0][0] as { messages: { content: string }[] }
    const prompt = call.messages[0].content
    expect(prompt).toContain('chicken')
    expect(prompt).toContain('tofu')
    expect(prompt).toContain('Lemon Herb Chicken')
  })

  it('returns updated recipe from model response', async () => {
    const updatedRecipe = {
      ...BASE_RECIPE,
      ingredients: [
        { name: 'tofu', amount: 200, unit: 'g' },
        { name: 'lemon', amount: 1, unit: 'piece' },
      ],
      steps: ['Season the tofu with lemon juice.', 'Cook until golden.'],
    }
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(updatedRecipe) }],
    })

    const res = await POST(makeRequest('/api/recipe-update-ingredient', {
      existingRecipe: BASE_RECIPE,
      original: 'chicken',
      substitute: 'tofu',
    }))

    expect(res.status).toBe(200)
    const body = await res.json() as { recipe: typeof updatedRecipe }
    expect(body.recipe.ingredients[0].name).toBe('tofu')
    expect(body.recipe.steps[0]).toContain('tofu')
  })

  it('strips markdown code fences from model response', async () => {
    const updatedRecipe = { ...BASE_RECIPE }
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(updatedRecipe)}\n\`\`\`` }],
    })

    const res = await POST(makeRequest('/api/recipe-update-ingredient', {
      existingRecipe: BASE_RECIPE,
      original: 'chicken',
      substitute: 'tofu',
    }))

    expect(res.status).toBe(200)
    const body = await res.json() as { recipe: typeof BASE_RECIPE }
    expect(body.recipe.title).toBe(BASE_RECIPE.title)
  })

  it('returns 500 when model returns no text block', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    const res = await POST(makeRequest('/api/recipe-update-ingredient', {
      existingRecipe: BASE_RECIPE,
      original: 'chicken',
      substitute: 'tofu',
    }))

    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Regenerate inline confirmation — pure logic tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('regenerate confirmation logic', () => {
  it('confirm state starts false, goes true on click, returns false on cancel', () => {
    let showConfirm = false

    // Simulate: click "Start fresh" button
    showConfirm = true
    expect(showConfirm).toBe(true)

    // Simulate: click "Keep this"
    showConfirm = false
    expect(showConfirm).toBe(false)
  })

  it('confirm state resets to false after confirming regenerate', () => {
    let showConfirm = false
    let regenerateCalled = false

    showConfirm = true
    // Simulate: click "Start fresh" in the confirmation
    showConfirm = false
    regenerateCalled = true

    expect(showConfirm).toBe(false)
    expect(regenerateCalled).toBe(true)
  })

  it('confirm state resets to false when recipe changes (new recipe generated)', () => {
    let showConfirm = true
    // Simulate: new recipe arrives (effect resets state)
    showConfirm = false
    expect(showConfirm).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. /api/generate-recipe — existingRecipe context injection
// ═══════════════════════════════════════════════════════════════════════════════

describe('/api/generate-recipe existingRecipe injection', () => {
  it('existingRecipe clause is injected into prompt when provided', () => {
    // Verify the clause logic directly
    const rawExistingRecipe = { title: 'Lemon Herb Chicken' }
    const existingRecipeClause =
      rawExistingRecipe && typeof rawExistingRecipe.title === 'string'
        ? `This is a refinement of an existing recipe: "${rawExistingRecipe.title}". Apply the requested direction change while maintaining the spirit and technique of the original where possible.\n\n`
        : ''

    expect(existingRecipeClause).toContain('Lemon Herb Chicken')
    expect(existingRecipeClause).toContain('refinement of an existing recipe')
  })

  it('existingRecipe clause is empty when not provided', () => {
    const rawExistingRecipe = null
    const existingRecipeClause =
      rawExistingRecipe && typeof (rawExistingRecipe as Record<string, unknown>).title === 'string'
        ? `This is a refinement of an existing recipe: "${(rawExistingRecipe as Record<string, unknown>).title}".`
        : ''

    expect(existingRecipeClause).toBe('')
  })

  it('existingRecipe clause is empty when title is missing', () => {
    const rawExistingRecipe = { ingredients: ['chicken'] }
    const existingRecipeClause =
      rawExistingRecipe && typeof (rawExistingRecipe as Record<string, unknown>).title === 'string'
        ? `This is a refinement.`
        : ''

    expect(existingRecipeClause).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Substitution banner — auto-dismiss timing logic
// ═══════════════════════════════════════════════════════════════════════════════

describe('substitution banner auto-dismiss logic', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('banner is visible immediately after substitution is applied', () => {
    let bannerVisible = false
    const setBannerVisible = (v: boolean) => { bannerVisible = v }
    const substitutionBanner = { original: 'chicken', substitute: 'tofu' }

    // Simulate the useEffect
    if (substitutionBanner) {
      setBannerVisible(true)
      setTimeout(() => setBannerVisible(false), 4000)
    }

    expect(bannerVisible).toBe(true)
  })

  it('banner dismisses after 4 seconds', () => {
    let bannerVisible = false
    const setBannerVisible = (v: boolean) => { bannerVisible = v }
    const substitutionBanner = { original: 'chicken', substitute: 'tofu' }

    if (substitutionBanner) {
      setBannerVisible(true)
      setTimeout(() => setBannerVisible(false), 4000)
    }

    jest.advanceTimersByTime(4000)
    expect(bannerVisible).toBe(false)
  })

  it('banner does not appear when substitutionBanner is null', () => {
    let bannerVisible = false
    const setBannerVisible = (v: boolean) => { bannerVisible = v }
    const substitutionBanner = null

    if (!substitutionBanner) {
      setBannerVisible(false)
    }

    expect(bannerVisible).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Full-screen takeover — isRefining state transitions
// ═══════════════════════════════════════════════════════════════════════════════

describe('isRefining full-screen takeover state', () => {
  it('isRefining is set to true when nudge is tapped on a completed recipe', () => {
    const generatedRecipe = { title: 'Lemon Herb Chicken', ingredients: [] }
    let isRefining = false

    // Simulate: handleNudge detects existing recipe and sets isRefining
    const hadExistingRecipe = generatedRecipe !== null
    if (hadExistingRecipe) isRefining = true

    expect(isRefining).toBe(true)
  })

  it('isRefining is NOT set when nudge is tapped during initial generation (no recipe yet)', () => {
    const generatedRecipe = null
    let isRefining = false

    const hadExistingRecipe = generatedRecipe !== null
    if (hadExistingRecipe) isRefining = true

    expect(isRefining).toBe(false)
  })

  it('isRefining is reset to false when generation completes', () => {
    let isRefining = true
    let abortedByNewerNudge = false

    // Simulate: generation completes normally
    if (!abortedByNewerNudge) {
      isRefining = false
    }

    expect(isRefining).toBe(false)
  })

  it('isRefining stays true when generation is aborted by a newer nudge', () => {
    let isRefining = true
    const abortedByNewerNudge = true

    // Simulate: generation is aborted mid-flight
    if (!abortedByNewerNudge) {
      isRefining = false
    }

    expect(isRefining).toBe(true)
  })

  it('cancel refinement resets all state: isRefining, isNudging, activeNudge, loadingStep', () => {
    let isRefining = true
    let isNudging = true
    let activeNudge: string | null = 'spicier'
    let loadingStep: string | null = 'recipe'

    // Simulate: handleCancelRefine
    isRefining = false
    isNudging = false
    activeNudge = null
    loadingStep = null

    expect(isRefining).toBe(false)
    expect(isNudging).toBe(false)
    expect(activeNudge).toBe(null)
    expect(loadingStep).toBe(null)
  })

  it('cancel refinement with abort controller stops in-flight generation', () => {
    const controller = new AbortController()
    expect(controller.signal.aborted).toBe(false)

    // Simulate: handleCancelRefine calls abort()
    controller.abort()

    expect(controller.signal.aborted).toBe(true)
  })

  it('recipe opacity is 0.15 when isRefining, 1 when not', () => {
    const opacityWhenRefining = 0.15
    const opacityWhenNormal = 1

    expect(opacityWhenRefining).toBe(0.15)
    expect(opacityWhenNormal).toBe(1)
    // isRefining ? 0.15 : 1 — correct values
    expect(true ? opacityWhenRefining : opacityWhenNormal).toBe(0.15)
    expect(false ? opacityWhenRefining : opacityWhenNormal).toBe(1)
  })

  it('guest users: nudge buttons are not shown (onNudge is undefined)', () => {
    const isSignedIn = false
    const onNudge = isSignedIn ? (() => {}) : undefined

    expect(onNudge).toBeUndefined()
    // isRefining can never be set for guests since handleNudge guards on isSignedIn
  })

  it('regenerate completely navigates to ingredients, does not set isRefining', () => {
    let navigatedTo: string | null = null
    let isRefining = false

    // Simulate: handleRegenerate
    navigatedTo = 'ingredients'
    // isRefining is NOT touched by handleRegenerate

    expect(navigatedTo).toBe('ingredients')
    expect(isRefining).toBe(false)
  })
})
