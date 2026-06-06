import { getUserId } from '../get-user-id'

// @/lib/auth is mapped to __mocks__/lib/auth.js via jest.config.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const authMod = require('@/lib/auth') as {
  auth: { api: { getSession: jest.MockedFunction<() => Promise<{ user: { id: string } } | null>> } }
}

beforeEach(() => {
  authMod.auth.api.getSession.mockReset()
})

describe('getUserId', () => {
  it('returns userId and isAuthenticated:true when session is active', async () => {
    authMod.auth.api.getSession.mockResolvedValue({ user: { id: 'user_123' } })
    const result = await getUserId('guest-uuid-456')
    expect(result).toEqual({ userId: 'user_123', isAuthenticated: true })
  })

  it('ignores guestId when session is active', async () => {
    authMod.auth.api.getSession.mockResolvedValue({ user: { id: 'user_123' } })
    const result = await getUserId('some-guest-id')
    expect(result.userId).toBe('user_123')
  })

  it('falls back to guestId with isAuthenticated:false when no session', async () => {
    authMod.auth.api.getSession.mockResolvedValue(null)
    const result = await getUserId('guest-uuid-456')
    expect(result).toEqual({ userId: 'guest-uuid-456', isAuthenticated: false })
  })

  it('throws when neither session nor guestId is available', async () => {
    authMod.auth.api.getSession.mockResolvedValue(null)
    await expect(getUserId()).rejects.toThrow('No userId available')
  })

  it('throws when guestId is undefined and no session', async () => {
    authMod.auth.api.getSession.mockResolvedValue(null)
    await expect(getUserId(undefined)).rejects.toThrow('No userId available')
  })
})
