import { useMutation } from '@tanstack/react-query'

export type SubmitFeedbackInput = {
  userId: string
  recipeId: string
  liked: boolean
  reasons: string[]
  notes: string
  recipeTitle: string
  recipeIngredients: string[]
  allergenProfile: string
}

async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function useSubmitFeedback() {
  return useMutation({ mutationFn: submitFeedback })
}
