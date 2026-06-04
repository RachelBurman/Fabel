import { auth } from '@clerk/nextjs/server'

export async function getUserId(guestId?: string): Promise<{
  userId: string
  isAuthenticated: boolean
}> {
  const { userId: clerkId } = await auth()
  if (clerkId) return { userId: clerkId, isAuthenticated: true }
  if (guestId) return { userId: guestId, isAuthenticated: false }
  throw new Error('No userId available')
}
