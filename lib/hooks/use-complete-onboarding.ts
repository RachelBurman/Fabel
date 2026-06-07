import { useMutation } from '@tanstack/react-query'

export type CompleteOnboardingInput = {
  userId: string
  onboardingComplete: true
}

async function completeOnboarding(input: CompleteOnboardingInput): Promise<void> {
  await fetch('/api/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function useCompleteOnboarding() {
  return useMutation({ mutationFn: completeOnboarding })
}
