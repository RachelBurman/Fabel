import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function getUserId(guestId?: string): Promise<{
  userId: string
  isAuthenticated: boolean
}> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user?.id) return { userId: session.user.id, isAuthenticated: true }
  if (guestId) return { userId: guestId, isAuthenticated: false }
  throw new Error('No userId available')
}

export class AuthRequiredError extends Error {
  constructor() {
    super('Authentication required')
    this.name = 'AuthRequiredError'
  }
}

export async function requireAuth(): Promise<{ userId: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new AuthRequiredError()
  return { userId: session.user.id }
}
