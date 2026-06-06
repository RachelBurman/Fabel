import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { migrateGuestToAuth } from '@/lib/guest-migration'

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const authUserId = session.user.id

  let body: { guestId?: string; onboardingComplete?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const guestId = typeof body.guestId === 'string' && body.guestId.trim() ? body.guestId.trim() : null
  if (!guestId) {
    return NextResponse.json({ error: 'Missing guestId' }, { status: 400 })
  }

  if (guestId === authUserId) {
    return NextResponse.json({ merged: false, reason: 'same-id' })
  }

  const onboardingComplete = body.onboardingComplete === true

  try {
    const result = await migrateGuestToAuth(guestId, authUserId, onboardingComplete)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[migrate-guest] Unexpected error:', err)
    return NextResponse.json({ merged: false, error: 'Migration failed' }, { status: 500 })
  }
}
