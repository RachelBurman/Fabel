import {
  checkRateLimit,
  incrementRateLimit,
  GUEST_HOUR_LIMIT,
  GUEST_DAY_LIMIT,
  AUTH_HOUR_LIMIT,
  AUTH_DAY_LIMIT,
} from '../rate-limiter'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../dynamo', () => ({
  dynamo: { send: jest.fn() },
}))

import { dynamo } from '../dynamo'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSend = dynamo.send as jest.MockedFunction<(...args: any[]) => any>

// Pin time to a known instant for deterministic window keys and TTL assertions
const FIXED_NOW = new Date('2026-06-04T15:23:00.000Z')
const FIXED_TS = FIXED_NOW.getTime()

beforeAll(() => {
  jest.useFakeTimers()
  jest.setSystemTime(FIXED_TS)
})

afterAll(() => {
  jest.useRealTimers()
})

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function mockGetResults(hourCount: number, dayCount: number) {
  mockSend
    .mockResolvedValueOnce({ Item: { count: hourCount } })
    .mockResolvedValueOnce({ Item: { count: dayCount } })
}

// ─── checkRateLimit — allowed below limits ─────────────────────────────────────

describe('checkRateLimit — allowed below limits', () => {
  it('returns allowed:true when both counters are zero', async () => {
    mockGetResults(0, 0)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(true)
  })

  it('returns allowed:true when counters are well below guest limits', async () => {
    mockGetResults(5, 15)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(true)
    expect(result.hourRemaining).toBe(GUEST_HOUR_LIMIT - 5)
    expect(result.dayRemaining).toBe(GUEST_DAY_LIMIT - 15)
  })

  it('returns allowed:true one below the hour limit', async () => {
    mockGetResults(GUEST_HOUR_LIMIT - 1, 0)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(true)
    expect(result.hourRemaining).toBe(1)
  })

  it('returns allowed:true one below the day limit', async () => {
    mockGetResults(0, GUEST_DAY_LIMIT - 1)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(true)
    expect(result.dayRemaining).toBe(1)
  })

  it('uses higher limits for authenticated users', async () => {
    mockGetResults(GUEST_HOUR_LIMIT + 1, 0) // would block a guest but not an auth user
    const result = await checkRateLimit('user-auth', true)
    expect(result.allowed).toBe(true)
    expect(result.hourRemaining).toBe(AUTH_HOUR_LIMIT - (GUEST_HOUR_LIMIT + 1))
  })

  it('returns correct auth day remaining', async () => {
    mockGetResults(0, AUTH_DAY_LIMIT - 10)
    const result = await checkRateLimit('user-auth', true)
    expect(result.dayRemaining).toBe(10)
  })
})

// ─── checkRateLimit — denied at exactly limit ──────────────────────────────────

describe('checkRateLimit — denied at exactly limit', () => {
  it('returns allowed:false at exactly the guest hour limit', async () => {
    mockGetResults(GUEST_HOUR_LIMIT, 0)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(false)
    expect(result.hourRemaining).toBe(0)
  })

  it('returns allowed:false at exactly the guest day limit', async () => {
    mockGetResults(0, GUEST_DAY_LIMIT)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(false)
    expect(result.dayRemaining).toBe(0)
  })

  it('returns allowed:false when hour limit is exceeded', async () => {
    mockGetResults(GUEST_HOUR_LIMIT + 5, 0)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(false)
    expect(result.hourRemaining).toBe(0)
  })

  it('returns allowed:false when day limit is exceeded', async () => {
    mockGetResults(0, GUEST_DAY_LIMIT + 1)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(false)
    expect(result.dayRemaining).toBe(0)
  })

  it('returns allowed:false at exactly the auth hour limit', async () => {
    mockGetResults(AUTH_HOUR_LIMIT, 0)
    const result = await checkRateLimit('user-auth', true)
    expect(result.allowed).toBe(false)
  })

  it('returns allowed:false at exactly the auth day limit', async () => {
    mockGetResults(0, AUTH_DAY_LIMIT)
    const result = await checkRateLimit('user-auth', true)
    expect(result.allowed).toBe(false)
  })
})

// ─── checkRateLimit — resetAt ─────────────────────────────────────────────────

describe('checkRateLimit — resetAt', () => {
  it('returns resetAt as the start of the next UTC hour', async () => {
    mockGetResults(0, 0)
    const result = await checkRateLimit('user-1', false)
    // Fixed time is 2026-06-04T15:23:00Z — next hour reset is 2026-06-04T16:00:00Z
    expect(result.resetAt).toBe('2026-06-04T16:00:00.000Z')
  })
})

// ─── checkRateLimit — item missing (first call) ───────────────────────────────

describe('checkRateLimit — missing items', () => {
  it('treats a missing item as count 0 (first call ever)', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Item: undefined })
    const result = await checkRateLimit('new-user', false)
    expect(result.allowed).toBe(true)
    expect(result.hourRemaining).toBe(GUEST_HOUR_LIMIT)
    expect(result.dayRemaining).toBe(GUEST_DAY_LIMIT)
  })
})

// ─── checkRateLimit — fail open on DynamoDB error ────────────────────────────

describe('checkRateLimit — fail open', () => {
  it('allows the request when DynamoDB throws', async () => {
    mockSend.mockRejectedValue(new Error('DynamoDB timeout'))
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(true)
  })

  it('returns full remaining counts when failing open', async () => {
    mockSend.mockRejectedValue(new Error('DynamoDB unavailable'))
    const result = await checkRateLimit('user-1', false)
    expect(result.hourRemaining).toBe(GUEST_HOUR_LIMIT)
    expect(result.dayRemaining).toBe(GUEST_DAY_LIMIT)
  })
})

// ─── incrementRateLimit — atomic ADD via TransactWriteCommand ─────────────────

describe('incrementRateLimit — atomic ADD', () => {
  it('calls DynamoDB once (TransactWriteCommand)', async () => {
    mockSend.mockResolvedValue({})
    await incrementRateLimit('user-1')
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('sends a TransactWriteCommand with two Update items', async () => {
    mockSend.mockResolvedValue({})
    await incrementRateLimit('user-1')
    const call = mockSend.mock.calls[0][0]
    const items = call.input?.TransactItems ?? call.input?.transactItems
    expect(items).toHaveLength(2)
    expect(items[0].Update).toBeDefined()
    expect(items[1].Update).toBeDefined()
  })

  it('uses ADD :one for both counter updates', async () => {
    mockSend.mockResolvedValue({})
    await incrementRateLimit('user-1')
    const call = mockSend.mock.calls[0][0]
    const items = call.input?.TransactItems ?? call.input?.transactItems
    for (const item of items) {
      expect(item.Update.UpdateExpression).toContain('ADD')
      expect(item.Update.ExpressionAttributeValues[':one']).toBe(1)
    }
  })

  it('does not throw when DynamoDB fails (fail open)', async () => {
    mockSend.mockRejectedValue(new Error('write failed'))
    await expect(incrementRateLimit('user-1')).resolves.toBeUndefined()
  })
})

// ─── Hour and day windows tracked independently ────────────────────────────────

describe('checkRateLimit — hour and day windows are independent', () => {
  it('is blocked when only the hour limit is reached', async () => {
    mockGetResults(GUEST_HOUR_LIMIT, 5)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(false)
  })

  it('is blocked when only the day limit is reached', async () => {
    mockGetResults(3, GUEST_DAY_LIMIT)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(false)
  })

  it('is allowed when both counters are exactly one below their limits', async () => {
    mockGetResults(GUEST_HOUR_LIMIT - 1, GUEST_DAY_LIMIT - 1)
    const result = await checkRateLimit('user-1', false)
    expect(result.allowed).toBe(true)
  })
})

// ─── TTL correctness ──────────────────────────────────────────────────────────

describe('incrementRateLimit — TTL values', () => {
  it('sets hourTtl to end of current UTC hour (Unix seconds)', async () => {
    mockSend.mockResolvedValue({})
    await incrementRateLimit('user-1')
    const call = mockSend.mock.calls[0][0]
    const items = call.input?.TransactItems ?? call.input?.transactItems
    const hourItem = items.find((i: { Update: { Key: { windowKey: string } } }) =>
      i.Update.Key.windowKey.startsWith('hour#')
    )
    const ttl: number = hourItem.Update.ExpressionAttributeValues[':ttlVal']
    // Fixed time: 2026-06-04T15:23Z. End of hour = 2026-06-04T16:00:00Z = 1749052800
    expect(ttl).toBe(Math.floor(new Date('2026-06-04T16:00:00.000Z').getTime() / 1000))
  })

  it('sets dayTtl to start of next UTC day (Unix seconds)', async () => {
    mockSend.mockResolvedValue({})
    await incrementRateLimit('user-1')
    const call = mockSend.mock.calls[0][0]
    const items = call.input?.TransactItems ?? call.input?.transactItems
    const dayItem = items.find((i: { Update: { Key: { windowKey: string } } }) =>
      i.Update.Key.windowKey.startsWith('day#')
    )
    const ttl: number = dayItem.Update.ExpressionAttributeValues[':ttlVal']
    // Start of next day = 2026-06-05T00:00:00Z
    expect(ttl).toBe(Math.floor(new Date('2026-06-05T00:00:00.000Z').getTime() / 1000))
  })
})

// ─── Correct table used ───────────────────────────────────────────────────────

describe('incrementRateLimit — table name', () => {
  it('writes to fable-rate-limits', async () => {
    mockSend.mockResolvedValue({})
    await incrementRateLimit('user-1')
    const call = mockSend.mock.calls[0][0]
    const items = call.input?.TransactItems ?? call.input?.transactItems
    for (const item of items) {
      expect(item.Update.TableName).toBe('fable-rate-limits')
    }
  })
})
