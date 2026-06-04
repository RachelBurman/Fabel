import { getUserId } from '../get-user-id'

// @clerk/nextjs/server is mapped to __mocks__/@clerk/nextjs/server.js via jest.config.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const clerkServer = require('@clerk/nextjs/server') as { auth: jest.MockedFunction<() => Promise<{ userId: string | null }>> }

beforeEach(() => {
  clerkServer.auth.mockReset()
})

describe('getUserId', () => {
  it('returns Clerk userId and isAuthenticated:true when session is active', async () => {
    clerkServer.auth.mockResolvedValue({ userId: 'clerk_user_123' })
    const result = await getUserId('guest-uuid-456')
    expect(result).toEqual({ userId: 'clerk_user_123', isAuthenticated: true })
  })

  it('ignores guestId when Clerk session is active', async () => {
    clerkServer.auth.mockResolvedValue({ userId: 'clerk_user_123' })
    const result = await getUserId('some-guest-id')
    expect(result.userId).toBe('clerk_user_123')
  })

  it('falls back to guestId with isAuthenticated:false when no session', async () => {
    clerkServer.auth.mockResolvedValue({ userId: null })
    const result = await getUserId('guest-uuid-456')
    expect(result).toEqual({ userId: 'guest-uuid-456', isAuthenticated: false })
  })

  it('throws when neither Clerk session nor guestId is available', async () => {
    clerkServer.auth.mockResolvedValue({ userId: null })
    await expect(getUserId()).rejects.toThrow('No userId available')
  })

  it('throws when guestId is undefined and no session', async () => {
    clerkServer.auth.mockResolvedValue({ userId: null })
    await expect(getUserId(undefined)).rejects.toThrow('No userId available')
  })
})
