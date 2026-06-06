/**
 * Integration tests for /api/user/profile GET and PATCH — onboardingComplete field.
 *
 * GET must return onboardingComplete from DynamoDB.
 * PATCH must write onboardingComplete via UpdateCommand without touching other fields.
 * PUT must include onboardingComplete in the full item write.
 */

import { NextRequest } from 'next/server'

// ─── Mock DynamoDB ─────────────────────────────────────────────────────────────

const mockSend = jest.fn()

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: mockSend },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(userId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/user/profile?userId=${userId}`,
    { method: 'GET' }
  )
}

function makePatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeStoredItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: 'user-123',
    allergens: [],
    customAllergens: [],
    ingredients: [],
    safeIngredients: [],
    safeFoodsMode: false,
    showMacros: false,
    activePresets: [],
    lactoseIntolerant: false,
    lactoseMode: 'include',
    kitchenEquipment: ['hob', 'oven'],
    darkMode: false,
    onboardingComplete: false,
    ...overrides,
  }
}

// ─── Route handlers ────────────────────────────────────────────────────────────

let GET: (req: NextRequest) => Promise<Response>
let PATCH: (req: NextRequest) => Promise<Response>
let PUT: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  const mod = await import('@/app/api/user/profile/route')
  GET = mod.GET
  PATCH = mod.PATCH
  PUT = mod.PUT
})

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/user/profile — onboardingComplete', () => {
  it('returns onboardingComplete: true when stored as true', async () => {
    mockSend.mockResolvedValue({ Item: makeStoredItem({ onboardingComplete: true }) })
    const res = await GET(makeGetRequest('user-123'))
    const body = await res.json()
    expect(body.onboardingComplete).toBe(true)
  })

  it('returns onboardingComplete: false when stored as false', async () => {
    mockSend.mockResolvedValue({ Item: makeStoredItem({ onboardingComplete: false }) })
    const res = await GET(makeGetRequest('user-123'))
    const body = await res.json()
    expect(body.onboardingComplete).toBe(false)
  })

  it('returns onboardingComplete: undefined when field is absent from stored item', async () => {
    const item = makeStoredItem()
    delete item.onboardingComplete
    mockSend.mockResolvedValue({ Item: item })
    const res = await GET(makeGetRequest('user-123'))
    const body = await res.json()
    expect(body.onboardingComplete).toBeUndefined()
  })

  it('includes onboardingComplete alongside other profile fields', async () => {
    mockSend.mockResolvedValue({ Item: makeStoredItem({ allergens: ['gluten'], onboardingComplete: true }) })
    const res = await GET(makeGetRequest('user-123'))
    const body = await res.json()
    expect(body.allergens).toEqual(['gluten'])
    expect(body.onboardingComplete).toBe(true)
  })
})

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/user/profile — onboardingComplete', () => {
  it('calls UpdateCommand (not PutCommand) to avoid overwriting other fields', async () => {
    mockSend.mockResolvedValue({})
    await PATCH(makePatchRequest({ userId: 'user-123', onboardingComplete: true }))
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.constructor.name).toBe('UpdateCommand')
  })

  it('sets onboardingComplete: true via UpdateExpression', async () => {
    mockSend.mockResolvedValue({})
    await PATCH(makePatchRequest({ userId: 'user-123', onboardingComplete: true }))
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.input.ExpressionAttributeValues[':val']).toBe(true)
    expect(cmd.input.UpdateExpression).toContain('onboardingComplete')
  })

  it('sets onboardingComplete: false via UpdateExpression', async () => {
    mockSend.mockResolvedValue({})
    await PATCH(makePatchRequest({ userId: 'user-123', onboardingComplete: false }))
    const cmd = mockSend.mock.calls[0][0]
    expect(cmd.input.ExpressionAttributeValues[':val']).toBe(false)
  })

  it('returns 400 when onboardingComplete is missing from body', async () => {
    const res = await PATCH(makePatchRequest({ userId: 'user-123' }))
    expect(res.status).toBe(400)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns 400 when userId is missing', async () => {
    const res = await PATCH(makePatchRequest({ onboardingComplete: true }))
    expect(res.status).toBe(400)
  })

  it('returns 200 ok on success', async () => {
    mockSend.mockResolvedValue({})
    const res = await PATCH(makePatchRequest({ userId: 'user-123', onboardingComplete: true }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})

// ─── PUT — onboardingComplete included in full write ─────────────────────────

describe('PUT /api/user/profile — onboardingComplete', () => {
  const basePutBody = {
    userId: 'user-123',
    allergens: [],
    customAllergens: [],
    ingredients: [],
    safeIngredients: [],
    safeFoodsMode: false,
    showMacros: false,
    activePresets: [],
    lactoseIntolerant: false,
    lactoseMode: 'include',
    kitchenEquipment: ['hob', 'oven'],
    darkMode: false,
  }

  it('writes onboardingComplete: true when provided', async () => {
    mockSend.mockResolvedValue({})
    await PUT(makePutRequest({ ...basePutBody, onboardingComplete: true }))
    const item = mockSend.mock.calls[0][0].input.Item
    expect(item.onboardingComplete).toBe(true)
  })

  it('writes onboardingComplete: false when provided', async () => {
    mockSend.mockResolvedValue({})
    await PUT(makePutRequest({ ...basePutBody, onboardingComplete: false }))
    const item = mockSend.mock.calls[0][0].input.Item
    expect(item.onboardingComplete).toBe(false)
  })

  it('defaults onboardingComplete to false when absent from body', async () => {
    mockSend.mockResolvedValue({})
    await PUT(makePutRequest(basePutBody))
    const item = mockSend.mock.calls[0][0].input.Item
    expect(item.onboardingComplete).toBe(false)
  })
})
