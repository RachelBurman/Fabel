/**
 * Tests for:
 * - GET /api/insights — returns correctly shaped data
 * - getInsightProfileKey — maps allergens + presets to profile keys
 * - getISOWeekString — returns YYYY-Www format
 */

import { NextRequest } from 'next/server'
import { getInsightProfileKey, getISOWeekString } from '../insight-profile'

// ─── Mock DynamoDB ─────────────────────────────────────────────────────────────

const mockSend = jest.fn()

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: mockSend },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(userId: string): NextRequest {
  return new NextRequest(`http://localhost/api/insights?userId=${userId}`, { method: 'GET' })
}

const sampleInsight = {
  allergenProfile: 'global',
  timeWindow: '2026-W23',
  trendingIngredients: [{ key: 'garlic', likeCount: 41, score: 0.92 }],
  trendingPairings: [{ beverage: 'green tea', recipeType: 'Asian', score: 0.89 }],
  trendingRecipeTypes: [{ cuisine: 'Italian', occasion: 'weeknight', score: 0.91 }],
  lastUpdated: '2026-06-01T00:00:00.000Z',
}

let GET: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const mod = await import('@/app/api/insights/route')
  GET = mod.GET
})

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── getInsightProfileKey ─────────────────────────────────────────────────────

describe('getInsightProfileKey', () => {
  it('returns "global" when no allergens or presets', () => {
    expect(getInsightProfileKey([], [])).toBe('global')
  })

  it('returns "vegan" for vegan preset', () => {
    expect(getInsightProfileKey([], ['vegan'])).toBe('vegan')
  })

  it('returns "low-fodmap" for low_fodmap preset', () => {
    expect(getInsightProfileKey([], ['low_fodmap'])).toBe('low-fodmap')
  })

  it('returns "gluten-free" for gluten allergen only', () => {
    expect(getInsightProfileKey(['gluten'], [])).toBe('gluten-free')
  })

  it('returns "dairy-free" for milk allergen only', () => {
    expect(getInsightProfileKey(['milk'], [])).toBe('dairy-free')
  })

  it('returns "nut-free" for tree_nuts allergen', () => {
    expect(getInsightProfileKey(['tree_nuts'], [])).toBe('nut-free')
  })

  it('returns "nut-free" for peanuts allergen', () => {
    expect(getInsightProfileKey(['peanuts'], [])).toBe('nut-free')
  })

  it('returns "gluten-free#dairy-free" for both gluten and milk', () => {
    expect(getInsightProfileKey(['gluten', 'milk'], [])).toBe('gluten-free#dairy-free')
  })

  it('prefers vegan preset over gluten allergen', () => {
    expect(getInsightProfileKey(['gluten'], ['vegan'])).toBe('vegan')
  })
})

// ─── getISOWeekString ─────────────────────────────────────────────────────────

describe('getISOWeekString', () => {
  it('returns a string in YYYY-Www format', () => {
    const result = getISOWeekString(new Date('2026-06-01'))
    expect(result).toMatch(/^\d{4}-W\d{2}$/)
  })

  it('returns 2026-W23 for 2026-06-01', () => {
    expect(getISOWeekString(new Date('2026-06-01'))).toBe('2026-W23')
  })

  it('returns 2026-W01 for 2026-01-01', () => {
    expect(getISOWeekString(new Date('2026-01-01'))).toBe('2026-W01')
  })
})

// ─── GET /api/insights ────────────────────────────────────────────────────────

describe('GET /api/insights', () => {
  it('returns 400 when userId is missing', async () => {
    const req = new NextRequest('http://localhost/api/insights', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns profileKey, weekStr, and insight records', async () => {
    // Profile fetch returns global user (no allergens)
    mockSend
      .mockResolvedValueOnce({ Item: { userId: 'u1', allergens: [], activePresets: [] } }) // user profile
      .mockResolvedValueOnce({ Item: sampleInsight })   // profileWeek
      .mockResolvedValueOnce({ Item: sampleInsight })   // profileAllTime
      // global user => no separate globalWeek call (profileKey === 'global')

    const res = await GET(makeGetRequest('u1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profileKey).toBe('global')
    expect(body.weekStr).toMatch(/^\d{4}-W\d{2}$/)
    expect(body.profileWeek).toBeTruthy()
    expect(body.profileWeek.trendingIngredients).toHaveLength(1)
  })

  it('computes gluten-free profile for a user with gluten allergen', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { userId: 'u2', allergens: ['gluten'], activePresets: [] } })
      .mockResolvedValueOnce({ Item: null })   // profileWeek (empty)
      .mockResolvedValueOnce({ Item: null })   // profileAllTime
      .mockResolvedValueOnce({ Item: sampleInsight }) // globalWeek (separate fetch since not global)

    const res = await GET(makeGetRequest('u2'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profileKey).toBe('gluten-free')
  })

  it('returns null records gracefully when table has no data', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: undefined })  // user not found → defaults
      .mockResolvedValueOnce({ Item: undefined })  // profileWeek
      .mockResolvedValueOnce({ Item: undefined })  // profileAllTime

    const res = await GET(makeGetRequest('new-user'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profileKey).toBe('global')
    expect(body.profileWeek).toBeNull()
    expect(body.profileAllTime).toBeNull()
  })
})
