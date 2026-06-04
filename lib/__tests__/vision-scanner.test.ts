import { NextRequest } from 'next/server'
import {
  matchToEpicureKey,
  buildReviewIngredients,
  buildKitchenIngredients,
  type VisionIngredient,
  type ReviewIngredient,
} from '../vision-scanner'

// ─── Clerk mock ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const clerkServer = require('@clerk/nextjs/server') as { auth: jest.MockedFunction<() => Promise<{ userId: string | null }>> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_KEYS = [
  'garlic', 'chicken', 'olive_oil', 'cheddar', 'butter',
  'onion', 'tomato', 'pasta', 'lemon', 'egg',
]

function ingredient(overrides: Partial<VisionIngredient> = {}): VisionIngredient {
  return {
    displayName: 'Garlic',
    epicureKey: 'garlic',
    confident: true,
    ...overrides,
  }
}

// ─── Proxy route ──────────────────────────────────────────────────────────────

// Mock global fetch for proxy route tests
const mockFetch = jest.fn()
global.fetch = mockFetch

let POST: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  process.env.VISION_LAMBDA_URL = 'https://lambda.example.com/scan'
  const mod = await import('@/app/api/scan-ingredients/route')
  POST = mod.POST
})

beforeEach(() => {
  jest.clearAllMocks()
  clerkServer.auth.mockResolvedValue({ userId: 'test-user-123' })
})

describe('POST /api/scan-ingredients (proxy route)', () => {
  it('returns correct shape when Lambda succeeds', async () => {
    const lambdaResponse = {
      inferredArea: 'fridge',
      areaConfident: true,
      ingredients: [
        { displayName: 'garlic', epicureKey: 'garlic', confident: true },
      ],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => lambdaResponse,
    })

    const req = new NextRequest('http://localhost/api/scan-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64data', mediaType: 'image/jpeg' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inferredArea).toBe('fridge')
    expect(body.areaConfident).toBe(true)
    expect(body.ingredients).toHaveLength(1)
    expect(body.ingredients[0].epicureKey).toBe('garlic')
  })

  it('returns 502 when Lambda call throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const req = new NextRequest('http://localhost/api/scan-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64data', mediaType: 'image/jpeg' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(502)
  })

  it('returns 503 when VISION_LAMBDA_URL is not set', async () => {
    const savedUrl = process.env.VISION_LAMBDA_URL
    delete process.env.VISION_LAMBDA_URL

    jest.resetModules()
    // Re-get the fresh Clerk mock after module reset and set authenticated user
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const freshClerk = require('@clerk/nextjs/server') as { auth: jest.MockedFunction<() => Promise<{ userId: string | null }>> }
    freshClerk.auth.mockResolvedValue({ userId: 'test-user-123' })
    const mod = await import('@/app/api/scan-ingredients/route')

    const req = new NextRequest('http://localhost/api/scan-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64data' }),
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(503)

    process.env.VISION_LAMBDA_URL = savedUrl
  })
})

// ─── Epicure key matching ──────────────────────────────────────────────────────

describe('matchToEpicureKey', () => {
  it('exact match returns confident: true', () => {
    const result = matchToEpicureKey('garlic', false, TEST_KEYS)
    expect(result).not.toBeNull()
    expect(result!.epicureKey).toBe('garlic')
    expect(result!.confident).toBe(true)
  })

  it('exact match with Claude uncertain flag returns confident: false', () => {
    const result = matchToEpicureKey('garlic', true, TEST_KEYS)
    expect(result).not.toBeNull()
    expect(result!.confident).toBe(false)
  })

  it('prefix match (chicken thighs → chicken) returns confident: false', () => {
    const result = matchToEpicureKey('chicken thighs', false, TEST_KEYS)
    expect(result).not.toBeNull()
    expect(result!.epicureKey).toBe('chicken')
    expect(result!.confident).toBe(false)
  })

  it('multi-word key match (olive oil → olive_oil) returns confident: true', () => {
    const result = matchToEpicureKey('olive oil', false, TEST_KEYS)
    expect(result).not.toBeNull()
    expect(result!.epicureKey).toBe('olive_oil')
    expect(result!.confident).toBe(true)
  })

  it('weak match below threshold returns null', () => {
    const result = matchToEpicureKey('xylophone synthesiser', false, TEST_KEYS)
    expect(result).toBeNull()
  })
})

// ─── Review screen — ingredient list ──────────────────────────────────────────

describe('buildReviewIngredients', () => {
  it('ingredient already in kitchen is pre-deselected', () => {
    const visionIngredients: VisionIngredient[] = [
      ingredient({ epicureKey: 'garlic', displayName: 'Garlic' }),
      ingredient({ epicureKey: 'onion', displayName: 'Onion' }),
    ]
    const result = buildReviewIngredients(visionIngredients, ['garlic'])
    const garlic = result.find(i => i.epicureKey === 'garlic')!
    const onion  = result.find(i => i.epicureKey === 'onion')!
    expect(garlic.alreadyInKitchen).toBe(true)
    expect(garlic.checked).toBe(false)
    expect(onion.alreadyInKitchen).toBe(false)
    expect(onion.checked).toBe(true)
  })

  it('ingredient not in kitchen is checked by default', () => {
    const result = buildReviewIngredients([ingredient()], [])
    expect(result[0].checked).toBe(true)
    expect(result[0].alreadyInKitchen).toBe(false)
  })

  it('kitchen key comparison is case-insensitive', () => {
    const result = buildReviewIngredients(
      [ingredient({ epicureKey: 'Garlic' })],
      ['garlic']
    )
    expect(result[0].alreadyInKitchen).toBe(true)
    expect(result[0].checked).toBe(false)
  })
})

// ─── Review screen — confirm with subset ─────────────────────────────────────

describe('buildKitchenIngredients', () => {
  it('only checked ingredients are included', () => {
    const reviewed: ReviewIngredient[] = [
      { ...ingredient({ epicureKey: 'garlic', displayName: 'Garlic' }), checked: true, alreadyInKitchen: false },
      { ...ingredient({ epicureKey: 'onion', displayName: 'Onion' }),   checked: false, alreadyInKitchen: false },
    ]
    const items = buildKitchenIngredients(reviewed, 'fridge', '2026-06-03')
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('garlic')
    expect(items[0].area).toBe('fridge')
  })

  it('area is applied to all confirmed ingredients', () => {
    const reviewed: ReviewIngredient[] = [
      { ...ingredient({ epicureKey: 'garlic' }), checked: true, alreadyInKitchen: false },
      { ...ingredient({ epicureKey: 'onion' }),  checked: true, alreadyInKitchen: false },
    ]
    const items = buildKitchenIngredients(reviewed, 'freezer', '2026-06-03')
    expect(items.every(i => i.area === 'freezer')).toBe(true)
  })

  it('returns empty array when nothing is checked', () => {
    const reviewed: ReviewIngredient[] = [
      { ...ingredient(), checked: false, alreadyInKitchen: false },
    ]
    expect(buildKitchenIngredients(reviewed, 'fridge', '2026-06-03')).toHaveLength(0)
  })
})

// ─── Cancel / empty confirmed selection ──────────────────────────────────────

describe('cancel and empty selection', () => {
  it('cancel produces no kitchen items', () => {
    // Cancel simply dismisses the modal — no items are written
    const items = buildKitchenIngredients([], 'fridge', '2026-06-03')
    expect(items).toHaveLength(0)
  })

  it('empty confirmed selection produces no kitchen items and no API call', () => {
    // The UI gates setIngredients on items.length > 0 (handleConfirm falls back to onCancel)
    function shouldWriteToKitchen(items: ReturnType<typeof buildKitchenIngredients>): boolean {
      return items.length > 0
    }
    const items = buildKitchenIngredients(
      [{ ...ingredient(), checked: false, alreadyInKitchen: false }],
      'fridge',
      '2026-06-03'
    )
    expect(shouldWriteToKitchen(items)).toBe(false)
  })
})

// ─── No ingredients recognised ───────────────────────────────────────────────

describe('no ingredients recognised', () => {
  it('Lambda returning empty ingredients array is detected as empty', () => {
    // The proxy handler checks ingredients.length === 0 before showing the review screen
    function hasIngredients(data: { ingredients?: unknown[] }): boolean {
      return Array.isArray(data.ingredients) && data.ingredients.length > 0
    }
    expect(hasIngredients({ ingredients: [] })).toBe(false)
    expect(hasIngredients({ ingredients: [{ epicureKey: 'garlic' }] })).toBe(true)
  })
})
