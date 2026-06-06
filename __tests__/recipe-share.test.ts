import { NextRequest } from 'next/server'

// ── DynamoDB mock ─────────────────────────────────────────────────────────────
const mockSend = jest.fn()
jest.mock('@/lib/dynamo', () => ({ dynamo: { send: mockSend } }))
jest.mock('@/lib/ttl', () => ({ ttlFromNow: () => 9999999999 }))

const RECIPE = {
  title: 'Test Pasta',
  description: 'A simple pasta dish',
  ingredients: [{ name: 'pasta', amount: 200, unit: 'grams' }],
  steps: ['Boil pasta', 'Serve'],
  cookTime: '15 mins',
  servings: 2,
  allergenFree: true,
}

describe('POST /api/recipe-share', () => {
  beforeEach(() => mockSend.mockReset())

  it('writes a share record and returns recipeId', async () => {
    mockSend.mockResolvedValueOnce({})
    const { POST } = await import('@/app/api/recipe-share/route')
    const req = new NextRequest('http://localhost/api/recipe-share', {
      method: 'POST',
      body: JSON.stringify({ recipeId: 'abc123', recipe: RECIPE }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipeId).toBe('abc123')
    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.input.Item.recipeId).toBe('abc123')
    expect(call.input.Item.title).toBe('Test Pasta')
    expect(call.input.Item.ttl).toBe(9999999999)
  })

  it('returns 400 when recipeId is missing', async () => {
    const { POST } = await import('@/app/api/recipe-share/route')
    const req = new NextRequest('http://localhost/api/recipe-share', {
      method: 'POST',
      body: JSON.stringify({ recipe: RECIPE }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when recipe is missing', async () => {
    const { POST } = await import('@/app/api/recipe-share/route')
    const req = new NextRequest('http://localhost/api/recipe-share', {
      method: 'POST',
      body: JSON.stringify({ recipeId: 'abc123' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/recipe-share/[recipeId]', () => {
  beforeEach(() => mockSend.mockReset())

  it('returns recipe when found', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        recipeId: 'abc123',
        fullRecipe: RECIPE,
        title: RECIPE.title,
        description: RECIPE.description,
      },
    })
    const { GET } = await import('@/app/api/recipe-share/[recipeId]/route')
    const req = new NextRequest('http://localhost/api/recipe-share/abc123')
    const res = await GET(req, { params: Promise.resolve({ recipeId: 'abc123' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipe.title).toBe('Test Pasta')
    expect(body.title).toBe('Test Pasta')
  })

  it('returns 404 when recipe not found', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined })
    const { GET } = await import('@/app/api/recipe-share/[recipeId]/route')
    const req = new NextRequest('http://localhost/api/recipe-share/missing')
    const res = await GET(req, { params: Promise.resolve({ recipeId: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
