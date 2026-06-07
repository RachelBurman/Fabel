import { useMutation } from '@tanstack/react-query'

export type MigrateGuestInput = {
  guestId: string
  onboardingComplete: boolean
}

export type MigrateGuestResult = {
  merged?: boolean
}

async function migrateGuest(input: MigrateGuestInput): Promise<MigrateGuestResult> {
  const res = await fetch('/api/user/migrate-guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) return {}
  return res.json() as Promise<MigrateGuestResult>
}

export function useMigrateGuest() {
  return useMutation({ mutationFn: migrateGuest })
}
