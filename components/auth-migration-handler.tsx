'use client'

import { useEffect } from 'react'
import { useSession } from '@/lib/auth-client'
import { toast } from 'sonner'

export function AuthMigrationHandler() {
  const { data: session } = useSession()
  const isSignedIn = !!session?.user
  const userId = session?.user?.id

  useEffect(() => {
    if (!isSignedIn || !userId) return

    const guestId = localStorage.getItem('fable_user_id')
    const alreadyMigrated = localStorage.getItem('fable-guest-migrated')

    if (!guestId || alreadyMigrated === userId) return

    fetch('/api/user/migrate-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId }),
    })
      .then(res => res.json())
      .then((data: { merged?: boolean }) => {
        if (data.merged) {
          toast.success('Your guest kitchen has been added to your account')
          localStorage.setItem('fable-guest-migrated', userId)
        }
      })
      .catch(() => {})
  }, [isSignedIn, userId])

  return null
}
