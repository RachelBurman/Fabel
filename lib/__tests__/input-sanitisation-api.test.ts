/**
 * Integration tests for /api/extract-ingredients input length validation.
 *
 * These tests call the route handler directly with a synthetic NextRequest,
 * covering the API-layer defence for oversized recipe text. The "ingredients
 * only" textarea is processed entirely on the frontend (split into lines) and
 * never sent to this endpoint, so it has no API-level test here.
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

// ─── Mock rate limiter ────────────────────────────────────────────────────────

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  incrementRateLimit: jest.fn().mockResolvedValue(undefined),
}))

// ─── Route under test ─────────────────────────────────────────────────────────

import { POST } from '../../app/api/extract-ingredients/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/extract-ingredients', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: 'flour\nsugar\nbutter' }],
  })
})

// ─── Length validation ────────────────────────────────────────────────────────

describe('/api/extract-ingredients — recipe text length guard', () => {
  it('returns 400 when recipe text exceeds 8,000 characters', async () => {
    const res = await POST(makeRequest({ text: 'x'.repeat(8001) }))
    expect(res.status).toBe(400)
  })

  it('returns the correct error shape when text is too long', async () => {
    const res = await POST(makeRequest({ text: 'a'.repeat(8001) }))
    const body = await res.json()
    expect(body.error).toBe('Input too long')
    expect(body.message).toMatch(/8,000/)
  })

  it('returns 400 at exactly 8,001 characters', async () => {
    const res = await POST(makeRequest({ text: 'b'.repeat(8001) }))
    expect(res.status).toBe(400)
  })

  it('does not call Claude when text exceeds the limit', async () => {
    await POST(makeRequest({ text: 'z'.repeat(9000) }))
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

// ─── Happy path (within limit) ───────────────────────────────────────────────

describe('/api/extract-ingredients — within-limit requests proceed normally', () => {
  it('returns 200 when text is exactly 8,000 characters', async () => {
    const res = await POST(makeRequest({ text: 'a'.repeat(8000) }))
    expect(res.status).toBe(200)
  })

  it('calls Claude and returns ingredients when text is within limit', async () => {
    const res = await POST(makeRequest({ text: 'flour, sugar and butter' }))
    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.ingredients).toEqual(['flour', 'sugar', 'butter'])
  })

  it('returns empty ingredients for blank text (not a length error)', async () => {
    const res = await POST(makeRequest({ text: '' }))
    expect(res.status).toBe(200)
    expect(mockCreate).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.ingredients).toEqual([])
  })
})

// ─── E2E: frontend bypassed, API catches oversized input ─────────────────────

describe('/api/extract-ingredients — defence in depth (frontend bypassed)', () => {
  it('rejects a request that bypasses the frontend limit', async () => {
    // Simulate a client that skips the frontend validation and sends oversized text
    const oversized = 'This is a very long recipe. '.repeat(300) // ~8,400 chars
    const res = await POST(makeRequest({ text: oversized }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Input too long')
  })

  it('accepts a request that just fits within the limit', async () => {
    const justFits = 'a'.repeat(8000)
    const res = await POST(makeRequest({ text: justFits }))
    expect(res.status).toBe(200)
  })
})
