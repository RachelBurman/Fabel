'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

export function AuthMigrationHandler() {
  const { isSignedIn, user } = useUser()

  useEffect(() => {
    if (!isSignedIn || !user?.id) return

    const guestId = localStorage.getItem('fable_user_id')
    const alreadyMigrated = localStorage.getItem('fable-guest-migrated')

    if (!guestId || alreadyMigrated === user.id) return

    fetch('/api/user/migrate-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId }),
    })
      .then(res => res.json())
      .then((data: { merged?: boolean }) => {
        if (data.merged) {
          toast.success('Your guest kitchen has been added to your account')
          localStorage.setItem('fable-guest-migrated', user.id)
        }
      })
      .catch(() => {})
  }, [isSignedIn, user?.id])

  return null
}
