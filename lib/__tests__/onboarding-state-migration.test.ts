/**
 * Tests for onboardingComplete handling in guest → auth migration.
 *
 * Covers migrateGuestToAuth directly (unit) and the migrate-guest route handler
 * (integration), verifying that the localStorage flag sent by the frontend is
 * correctly propagated into the DynamoDB write.
 */

import { NextRequest } from 'next/server'

// ─── Mock DynamoDB ─────────────────────────────────────────────────────────────

jest.mock('@/lib/dynamo', () => ({
  dynamo: { send: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { dynamo } = require('@/lib/dynamo') as { dynamo: { send: jest.MockedFunction<(cmd: unknown) => Promise<unknown>> } }

// ─── Mock auth (migrate-guest route needs session) ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const authMod = require('@/lib/auth') as {
  auth: { api: { getSession: jest.MockedFunction<() => Promise<{ user: { id: string } } | null>> } }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cmdName(cmd: unknown): string {
  return (cmd as { constructor: { name: string } }).constructor.name
}

function cmdKey(cmd: unknown): Record<string, unknown> {
  return ((cmd as { input: { Key: Record<string, unknown> } }).input?.Key) ?? {}
}

function getPutItem(calls: unknown[][]): Record<string, unknown> | undefined {
  for (const [cmd] of calls) {
    if (cmdName(cmd) === 'PutCommand') {
      return (cmd as { input: { Item: Record<string, unknown> } }).input.Item
    }
  }
}

function makeGuestRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: 'guest-abc',
    allergens: [],
    customAllergens: [],
    safeIngredients: [],
    activePresets: [],
    ingredients: [],
    preferenceSignals: [],
    ...overrides,
  }
}

beforeEach(() => {
  dynamo.send.mockReset()
})

// ─── migrateGuestToAuth — no existing auth record ─────────────────────────────

describe('migrateGuestToAuth — onboardingComplete with no existing auth record', () => {
  async function runMigration(onboardingComplete: boolean) {
    const puts: Record<string, unknown>[] = []
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest-abc') return Promise.resolve({ Item: makeGuestRecord() })
        return Promise.resolve({ Item: undefined }) // no auth record
      }
      if (cmdName(cmd) === 'PutCommand') {
        puts.push((cmd as { input: { Item: Record<string, unknown> } }).input.Item)
      }
      return Promise.resolve({ Items: [] })
    })
    const { migrateGuestToAuth } = await import('../guest-migration')
    await migrateGuestToAuth('guest-abc', 'auth-xyz', onboardingComplete)
    return puts
  }

  it('writes onboardingComplete: true when flag is true', async () => {
    const puts = await runMigration(true)
    expect(puts[0]?.onboardingComplete).toBe(true)
  })

  it('writes onboardingComplete: false when flag is false', async () => {
    const puts = await runMigration(false)
    expect(puts[0]?.onboardingComplete).toBe(false)
  })

  it('combines guest DB value OR with the param (guest true, param false → true)', async () => {
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest-abc') {
          return Promise.resolve({ Item: makeGuestRecord({ onboardingComplete: true }) })
        }
        return Promise.resolve({ Item: undefined })
      }
      return Promise.resolve({ Items: [] })
    })
    const { migrateGuestToAuth } = await import('../guest-migration')
    await migrateGuestToAuth('guest-abc', 'auth-xyz', false)
    const item = getPutItem(dynamo.send.mock.calls as unknown[][])
    expect(item?.onboardingComplete).toBe(true)
  })
})

// ─── migrateGuestToAuth — existing auth record (merge path) ──────────────────

describe('migrateGuestToAuth — onboardingComplete with existing auth record', () => {
  function setupMocks(guestOnboarding: boolean, authOnboarding: boolean) {
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest-abc') {
          return Promise.resolve({ Item: makeGuestRecord({ onboardingComplete: guestOnboarding }) })
        }
        return Promise.resolve({
          Item: {
            userId: 'auth-xyz',
            allergens: [],
            customAllergens: [],
            safeIngredients: [],
            activePresets: [],
            ingredients: [],
            preferenceSignals: [],
            onboardingComplete: authOnboarding,
          },
        })
      }
      return Promise.resolve({ Items: [] })
    })
  }

  it('writes true when param is true, even if both stored values are false', async () => {
    setupMocks(false, false)
    const { migrateGuestToAuth } = await import('../guest-migration')
    await migrateGuestToAuth('guest-abc', 'auth-xyz', true)
    const item = getPutItem(dynamo.send.mock.calls as unknown[][])
    expect(item?.onboardingComplete).toBe(true)
  })

  it('writes true when auth record already has true', async () => {
    setupMocks(false, true)
    const { migrateGuestToAuth } = await import('../guest-migration')
    await migrateGuestToAuth('guest-abc', 'auth-xyz', false)
    const item = getPutItem(dynamo.send.mock.calls as unknown[][])
    expect(item?.onboardingComplete).toBe(true)
  })

  it('writes false when all sources are false', async () => {
    setupMocks(false, false)
    const { migrateGuestToAuth } = await import('../guest-migration')
    await migrateGuestToAuth('guest-abc', 'auth-xyz', false)
    const item = getPutItem(dynamo.send.mock.calls as unknown[][])
    expect(item?.onboardingComplete).toBe(false)
  })
})

// ─── /api/user/migrate-guest route — passes flag from body ───────────────────

describe('POST /api/user/migrate-guest — onboardingComplete from request body', () => {
  function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost/api/user/migrate-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  beforeEach(() => {
    authMod.auth.api.getSession.mockResolvedValue({ user: { id: 'auth-xyz' } })
  })

  it('passes onboardingComplete: true from body when localStorage flag was present', async () => {
    const puts: Record<string, unknown>[] = []
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest-abc') return Promise.resolve({ Item: makeGuestRecord() })
        return Promise.resolve({ Item: undefined })
      }
      if (cmdName(cmd) === 'PutCommand') {
        puts.push((cmd as { input: { Item: Record<string, unknown> } }).input.Item)
      }
      return Promise.resolve({ Items: [] })
    })

    const { POST } = await import('@/app/api/user/migrate-guest/route')
    await POST(makeRequest({ guestId: 'guest-abc', onboardingComplete: true }))

    expect(puts[0]?.onboardingComplete).toBe(true)
  })

  it('passes onboardingComplete: false when localStorage flag was absent', async () => {
    const puts: Record<string, unknown>[] = []
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest-abc') return Promise.resolve({ Item: makeGuestRecord() })
        return Promise.resolve({ Item: undefined })
      }
      if (cmdName(cmd) === 'PutCommand') {
        puts.push((cmd as { input: { Item: Record<string, unknown> } }).input.Item)
      }
      return Promise.resolve({ Items: [] })
    })

    const { POST } = await import('@/app/api/user/migrate-guest/route')
    await POST(makeRequest({ guestId: 'guest-abc', onboardingComplete: false }))

    expect(puts[0]?.onboardingComplete).toBe(false)
  })

  it('treats missing onboardingComplete in body as false', async () => {
    const puts: Record<string, unknown>[] = []
    dynamo.send.mockImplementation((cmd) => {
      if (cmdName(cmd) === 'GetCommand') {
        const uid = cmdKey(cmd).userId as string
        if (uid === 'guest-abc') return Promise.resolve({ Item: makeGuestRecord() })
        return Promise.resolve({ Item: undefined })
      }
      if (cmdName(cmd) === 'PutCommand') {
        puts.push((cmd as { input: { Item: Record<string, unknown> } }).input.Item)
      }
      return Promise.resolve({ Items: [] })
    })

    const { POST } = await import('@/app/api/user/migrate-guest/route')
    await POST(makeRequest({ guestId: 'guest-abc' })) // no onboardingComplete

    expect(puts[0]?.onboardingComplete).toBe(false)
  })
})
