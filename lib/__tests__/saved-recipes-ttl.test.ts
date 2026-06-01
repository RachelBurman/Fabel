/**
 * Tests for TTL behaviour in /api/user/saved-recipes.
 *
 * Verifies that:
 *  - History entries (isSaved: false / absent) get a 90-day TTL attribute
 *  - Explicitly saved recipes (isSaved: true) have no TTL attribute
 *  - A save that overwrites a history entry (same recipeId) clears the TTL
 *  - GET returns only explicitly saved items, filtering out history entries
 */

import { NextRequest } from 'next/server'
import { TTL_90_DAYS_SECONDS } from '../ttl'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSend = jest.fn()

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: mockSend },
}))

jest.mock('@/lib/ttl', () => ({
  ttlFromNow: jest.fn(() => 9_999_999_999),
  TTL_90_DAYS_SECONDS: 7_776_000,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/user/saved-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(userId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/user/saved-recipes?userId=${encodeURIComponent(userId)}`,
    { method: 'GET' }
  )
}

function capturedItem(): Record<string, unknown> {
  expect(mockSend).toHaveBeenCalled()
  const call = mockSend.mock.calls[0][0]
  return call.input.Item as Record<string, unknown>
}

const MINIMAL_USER_ID = 'user-123'
const MINIMAL_RECIPE = {
  id: 'rec-1',
  title: 'Test Recipe',
  isSaved: false,
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let POST: (req: NextRequest) => Promise<Response>
let GET: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const mod = await import('@/app/api/user/saved-recipes/route')
  POST = mod.POST
  GET = mod.GET
})

beforeEach(() => {
  jest.clearAllMocks()
  mockSend.mockResolvedValue({ Items: [] })
})

// ─── POST — TTL assignment ────────────────────────────────────────────────────

describe('POST /api/user/saved-recipes — TTL assignment', () => {
  it('sets ttl on a history entry (isSaved: false)', async () => {
    const res = await POST(makeRequest({ userId: MINIMAL_USER_ID, recipe: MINIMAL_RECIPE }))
    expect(res.status).toBe(200)
    expect(capturedItem().ttl).toBe(9_999_999_999)
  })

  it('sets ttl when isSaved field is absent (defaults to history)', async () => {
    const recipe = { id: 'rec-2', title: 'Test' }  // no isSaved field
    const res = await POST(makeRequest({ userId: MINIMAL_USER_ID, recipe }))
    expect(res.status).toBe(200)
    expect(capturedItem().ttl).toBe(9_999_999_999)
  })

  it('does NOT set ttl on an explicitly saved recipe (isSaved: true)', async () => {
    const recipe = { id: 'rec-3', title: 'Saved Recipe', isSaved: true }
    const res = await POST(makeRequest({ userId: MINIMAL_USER_ID, recipe }))
    expect(res.status).toBe(200)
    expect(capturedItem().ttl).toBeUndefined()
  })

  it('preserves isSaved: true in the written item', async () => {
    const recipe = { id: 'rec-4', isSaved: true }
    await POST(makeRequest({ userId: MINIMAL_USER_ID, recipe }))
    expect(capturedItem().isSaved).toBe(true)
  })

  it('preserves isSaved: false in the written item', async () => {
    await POST(makeRequest({ userId: MINIMAL_USER_ID, recipe: MINIMAL_RECIPE }))
    expect(capturedItem().isSaved).toBe(false)
  })

  it('uses the recipe id as the DynamoDB sort key (recipeId)', async () => {
    await POST(makeRequest({ userId: MINIMAL_USER_ID, recipe: { id: 'my-id', isSaved: false } }))
    expect(capturedItem().recipeId).toBe('my-id')
  })

  it('returns 400 when userId is missing', async () => {
    const res = await POST(makeRequest({ recipe: MINIMAL_RECIPE }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when recipe is missing', async () => {
    const res = await POST(makeRequest({ userId: MINIMAL_USER_ID }))
    expect(res.status).toBe(400)
  })
})

// ─── POST — save overwrites history (TTL cleared) ─────────────────────────────

describe('POST — save overwrites history entry (TTL cleared)', () => {
  it('second PUT with isSaved: true for same recipeId has no ttl', async () => {
    // First call: history entry with TTL
    await POST(makeRequest({
      userId: MINIMAL_USER_ID,
      recipe: { id: 'shared-id', isSaved: false },
    }))
    expect(mockSend.mock.calls[0][0].input.Item.ttl).toBe(9_999_999_999)

    // Second call: explicit save — same recipeId, no TTL
    jest.clearAllMocks()
    await POST(makeRequest({
      userId: MINIMAL_USER_ID,
      recipe: { id: 'shared-id', isSaved: true },
    }))
    expect(capturedItem().recipeId).toBe('shared-id')
    expect(capturedItem().ttl).toBeUndefined()
    expect(capturedItem().isSaved).toBe(true)
  })
})

// ─── GET — filters out history entries ───────────────────────────────────────

describe('GET /api/user/saved-recipes — filters history entries', () => {
  it('returns only items where isSaved !== false', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { recipeId: 'saved-1', isSaved: true,      title: 'Saved Recipe' },
        { recipeId: 'hist-1',  isSaved: false,     title: 'History Entry', ttl: 9_999_999_999 },
        { recipeId: 'old-1',                       title: 'Old Record (no isSaved field)' },
      ],
    })
    const res = await GET(makeGetRequest(MINIMAL_USER_ID))
    const body = await res.json()
    expect(body.recipes).toHaveLength(2)
    expect(body.recipes.map((r: { recipeId: string }) => r.recipeId)).toContain('saved-1')
    expect(body.recipes.map((r: { recipeId: string }) => r.recipeId)).toContain('old-1')
    expect(body.recipes.map((r: { recipeId: string }) => r.recipeId)).not.toContain('hist-1')
  })

  it('returns an empty array when all items are history entries', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { recipeId: 'hist-1', isSaved: false, ttl: 9_999_999_999 },
        { recipeId: 'hist-2', isSaved: false, ttl: 9_999_999_999 },
      ],
    })
    const res = await GET(makeGetRequest(MINIMAL_USER_ID))
    const body = await res.json()
    expect(body.recipes).toEqual([])
  })

  it('returns 400 when userId is missing', async () => {
    const req = new NextRequest('http://localhost/api/user/saved-recipes', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})

// ─── TTL value sanity (real ttlFromNow, not mocked) ──────────────────────────

describe('TTL value sanity check', () => {
  it('TTL_90_DAYS_SECONDS is exactly 90 days in seconds', () => {
    expect(TTL_90_DAYS_SECONDS).toBe(90 * 24 * 60 * 60)
  })
})
