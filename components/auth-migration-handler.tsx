'use client'

import { useEffect } from 'react'
import { useSession } from '@/lib/auth-client'
import { toast } from 'sonner'
import { useMigrateGuest } from '@/lib/hooks/use-migrate-guest'

export function AuthMigrationHandler() {
  const { data: session } = useSession()
  const isSignedIn = !!session?.user
  const userId = session?.user?.id
  const migrateGuest = useMigrateGuest()

  useEffect(() => {
    if (!isSignedIn || !userId) return

    const guestId = localStorage.getItem('fable_user_id')
    const alreadyMigrated = localStorage.getItem('fable-guest-migrated')

    if (!guestId || alreadyMigrated === userId) return

    migrateGuest
      .mutateAsync({
        guestId,
        onboardingComplete: localStorage.getItem('fable-onboarding-complete') !== null,
      })
      .then((data) => {
        if (data.merged) {
          toast.success('Your guest kitchen has been added to your account')
          localStorage.setItem('fable-guest-migrated', userId)
        }
      })
      .catch(() => {})
  }, [isSignedIn, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
