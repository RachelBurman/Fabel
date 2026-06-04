import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { migrateGuestToAuth } from '@/lib/guest-migration'

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { guestId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const guestId = typeof body.guestId === 'string' && body.guestId.trim() ? body.guestId.trim() : null
  if (!guestId) {
    return NextResponse.json({ error: 'Missing guestId' }, { status: 400 })
  }

  if (guestId === clerkId) {
    return NextResponse.json({ merged: false, reason: 'same-id' })
  }

  try {
    const result = await migrateGuestToAuth(guestId, clerkId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[migrate-guest] Unexpected error:', err)
    return NextResponse.json({ merged: false, error: 'Migration failed' }, { status: 500 })
  }
}
