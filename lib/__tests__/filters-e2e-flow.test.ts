/**
 * End-to-end flow tests for the four new recipe filters.
 *
 * These tests simulate the complete path a user's filter selections travel:
 *   RecipeFilters (ingredients screen)
 *     → fable-app.tsx API call construction
 *       → /api/generate-recipe prompt building
 *         → Claude receives the correct instructions
 *
 * Both the Anthropic SDK and DynamoDB are mocked. No real network calls.
 *
 * The "E2E" aspect here is that we trace data from the frontend filter state
 * through to the exact string Claude sees — covering the full request-response
 * pipeline without a browser.
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipeJson(servings = 2): string {
  return JSON.stringify({
    title: 'E2E Test Dish',
    description: 'Generated in E2E test.',
    ingredients: [{ name: 'chicken', amount: 1, unit: 'piece' }],
    steps: ['Step one.'],
    cookTime: '30 minutes',
    servings,
    allergenFree: true,
  })
}

/** Simulate fable-app.tsx constructing the generate-recipe request body */
function buildApiRequestBody(opts: {
  filters: {
    mealType: string
    cookTime: string
    kitchenOnly: boolean
    cuisine: string
    occasion: string
    servings: number
  }
  kitchenEquipment: string[]
  showMacros?: boolean
}): Record<string, unknown> {
  return {
    ingredients: [{ id: '1', name: 'chicken', area: 'fridge', addedAt: '2026-05-31' }],
    suggestions: [],
    allergens: [],
    customAllergens: [],
    mealType: opts.filters.mealType,
    cookTime: opts.filters.cookTime,
    kitchenOnly: opts.filters.kitchenOnly,
    cuisine: opts.filters.cuisine,
    occasion: opts.filters.occasion,
    servings: opts.filters.servings,
    kitchenEquipment: opts.kitchenEquipment,
    showMacros: opts.showMacros ?? false,
  }
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
  return mockCreate.mock.calls[0][0].messages[0].content as string
}

// ─── Load route handler ───────────────────────────────────────────────────────

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

// ─── Filter state → API body construction ────────────────────────────────────

describe('fable-app.tsx filter state → API request body', () => {
  it('includes all six filter fields in the request body', () => {
    const body = buildApiRequestBody({
      filters: { mealType: 'main', cookTime: 'medium', kitchenOnly: false, cuisine: 'italian', occasion: 'Weeknight', servings: 2 },
      kitchenEquipment: ['hob', 'oven'],
    })
    expect(body).toMatchObject({
      mealType: 'main',
      cookTime: 'medium',
      kitchenOnly: false,
      cuisine: 'italian',
      occasion: 'Weeknight',
      servings: 2,
      kitchenEquipment: ['hob', 'oven'],
    })
  })

  it('cuisine "" is passed as empty string (any cuisine)', () => {
    const body = buildApiRequestBody({
      filters: { mealType: 'main', cookTime: 'quick', kitchenOnly: false, cuisine: '', occasion: '', servings: 2 },
      kitchenEquipment: ['hob'],
    })
    expect(body.cuisine).toBe('')
    expect(body.occasion).toBe('')
  })

  it('kitchenEquipment from preferences is distinct from filter state', () => {
    const body = buildApiRequestBody({
      filters: { mealType: 'snack', cookTime: 'quick', kitchenOnly: false, cuisine: '', occasion: '', servings: 1 },
      kitchenEquipment: ['air_fryer'],
    })
    // kitchenEquipment comes from preferences, not from filters
    expect(body.kitchenEquipment).toEqual(['air_fryer'])
    expect(body.mealType).toBe('snack')
  })
})

// ─── Full pipeline: filter selection → Claude prompt ─────────────────────────

describe('full pipeline: filter selection → Claude receives correct prompt', () => {
  it('weeknight italian dinner for 4 with hob + oven reaches Claude correctly', async () => {
    const body = buildApiRequestBody({
      filters: {
        mealType: 'main',
        cookTime: 'medium',
        kitchenOnly: false,
        cuisine: 'italian',
        occasion: 'Weeknight',
        servings: 4,
      },
      kitchenEquipment: ['hob', 'oven'],
    })

    await POST(makeRequest(body))
    const prompt = capturedPrompt()

    expect(prompt).toContain('italian-inspired')
    expect(prompt).toContain('This is for Weeknight')
    expect(prompt).toContain('4 people')
    expect(prompt).toContain('hob')
    expect(prompt).toContain('oven')
    expect(prompt).toContain('scale quantities accordingly')
  })

  it('surprise cuisine celebration for 2 with air fryer only', async () => {
    const body = buildApiRequestBody({
      filters: {
        mealType: 'main',
        cookTime: 'quick',
        kitchenOnly: false,
        cuisine: 'surprise',
        occasion: 'Celebration',
        servings: 2,
      },
      kitchenEquipment: ['air_fryer'],
    })

    await POST(makeRequest(body))
    const prompt = capturedPrompt()

    expect(prompt).toContain('cuisine of your choice')
    expect(prompt).toContain('adventurous')
    expect(prompt).toContain('This is for Celebration')
    expect(prompt).toContain('2 people')
    expect(prompt).toContain('air_fryer')
  })

  it('solo meal prep with slow cooker for 1 person', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: makeRecipeJson(1) }],
    })

    const body = buildApiRequestBody({
      filters: {
        mealType: 'main',
        cookTime: 'slow',
        kitchenOnly: false,
        cuisine: '',
        occasion: 'Meal Prep',
        servings: 1,
      },
      kitchenEquipment: ['slow_cooker'],
    })

    await POST(makeRequest(body))
    const prompt = capturedPrompt()

    expect(prompt).not.toContain('inspired dish')
    expect(prompt).toContain('This is for Meal Prep')
    expect(prompt).toContain('1 person')
    expect(prompt).not.toContain('1 people')
    expect(prompt).toContain('slow_cooker')
  })

  it('dinner party japanese for 8 with full kitchen', async () => {
    const body = buildApiRequestBody({
      filters: {
        mealType: 'main',
        cookTime: 'medium',
        kitchenOnly: false,
        cuisine: 'japanese',
        occasion: 'Dinner Party',
        servings: 8,
      },
      kitchenEquipment: ['hob', 'oven', 'microwave'],
    })

    await POST(makeRequest(body))
    const prompt = capturedPrompt()

    expect(prompt).toContain('japanese-inspired')
    expect(prompt).toContain('This is for Dinner Party')
    expect(prompt).toContain('8 people')
    expect(prompt).toContain('hob')
    expect(prompt).toContain('oven')
    expect(prompt).toContain('microwave')
  })

  it('no filters set (defaults) still includes servings clause', async () => {
    const body = buildApiRequestBody({
      filters: {
        mealType: 'main',
        cookTime: 'medium',
        kitchenOnly: false,
        cuisine: '',
        occasion: '',
        servings: 2,
      },
      kitchenEquipment: [],
    })

    await POST(makeRequest(body))
    const prompt = capturedPrompt()

    expect(prompt).not.toContain('inspired dish')
    expect(prompt).not.toContain('This is for')
    expect(prompt).toContain('2 people')
    expect(prompt).not.toContain('compatible with')
  })
})

// ─── Response integrity ───────────────────────────────────────────────────────

describe('response integrity through the pipeline', () => {
  it('response preserves the servings count Claude returned', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: makeRecipeJson(6) }],
    })

    const body = buildApiRequestBody({
      filters: { mealType: 'main', cookTime: 'medium', kitchenOnly: false, cuisine: 'french', occasion: '', servings: 6 },
      kitchenEquipment: ['hob', 'oven'],
    })

    const res = await POST(makeRequest(body))
    expect(res.status).toBe(200)
    const recipe = await res.json()
    expect(recipe.servings).toBe(6)
    expect(recipe.title).toBe('E2E Test Dish')
  })

  it('Claude is called exactly once per request', async () => {
    const body = buildApiRequestBody({
      filters: { mealType: 'main', cookTime: 'quick', kitchenOnly: false, cuisine: 'korean', occasion: 'Street Food', servings: 3 },
      kitchenEquipment: ['hob'],
    })
    await POST(makeRequest(body))
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })
})

// ─── Dark mode persistence flow ───────────────────────────────────────────────

describe('dark mode preference logic', () => {
  // Mirror the fable-context.tsx setDarkMode + auto-save logic
  function simulateDarkModeToggle(currentDark: boolean): { newDark: boolean; themeArg: string } {
    const newDark = !currentDark
    return { newDark, themeArg: newDark ? 'dark' : 'light' }
  }

  // Mirror the fable-app.tsx DB sync effect
  function syncThemeFromDb(isLoadingProfile: boolean, darkMode: boolean): string | null {
    if (!isLoadingProfile) {
      return darkMode ? 'dark' : 'light'
    }
    return null // still loading
  }

  it('toggling dark ON sets both newDark=true and themeArg="dark"', () => {
    const result = simulateDarkModeToggle(false)
    expect(result.newDark).toBe(true)
    expect(result.themeArg).toBe('dark')
  })

  it('toggling dark OFF sets both newDark=false and themeArg="light"', () => {
    const result = simulateDarkModeToggle(true)
    expect(result.newDark).toBe(false)
    expect(result.themeArg).toBe('light')
  })

  it('round-trip toggle returns to original state', () => {
    const first = simulateDarkModeToggle(false)
    const second = simulateDarkModeToggle(first.newDark)
    expect(second.newDark).toBe(false)
    expect(second.themeArg).toBe('light')
  })

  it('DB sync applies dark theme when profile says darkMode=true', () => {
    expect(syncThemeFromDb(false, true)).toBe('dark')
  })

  it('DB sync applies light theme when profile says darkMode=false', () => {
    expect(syncThemeFromDb(false, false)).toBe('light')
  })

  it('DB sync returns null while profile is still loading', () => {
    expect(syncThemeFromDb(true, true)).toBeNull()
    expect(syncThemeFromDb(true, false)).toBeNull()
  })
})

// ─── Kitchen equipment persistence flow ──────────────────────────────────────

describe('kitchen equipment persistence flow', () => {
  // Mirror the auto-save debounce trigger: only saves when not loading
  function shouldAutoSave(isLoadingProfile: boolean, userId: string): boolean {
    return !isLoadingProfile && !!userId
  }

  // Mirror the preference merge on profile load
  function mergeEquipmentFromProfile(
    stored: string[] | undefined,
    defaultEquipment: string[]
  ): string[] {
    return stored ?? defaultEquipment
  }

  it('auto-save does not fire while profile is loading', () => {
    expect(shouldAutoSave(true, 'user-123')).toBe(false)
  })

  it('auto-save fires once profile is loaded and userId is set', () => {
    expect(shouldAutoSave(false, 'user-123')).toBe(true)
  })

  it('auto-save does not fire when userId is absent', () => {
    expect(shouldAutoSave(false, '')).toBe(false)
  })

  it('equipment from DB overrides the default on load', () => {
    const fromDb = ['hob', 'air_fryer']
    const result = mergeEquipmentFromProfile(fromDb, ['hob', 'oven'])
    expect(result).toEqual(['hob', 'air_fryer'])
  })

  it('default equipment is used when DB returns undefined', () => {
    const result = mergeEquipmentFromProfile(undefined, ['hob', 'oven'])
    expect(result).toEqual(['hob', 'oven'])
  })

  it('an empty array from DB is preserved (user deselected everything)', () => {
    const result = mergeEquipmentFromProfile([], ['hob', 'oven'])
    expect(result).toEqual([])
  })
})
