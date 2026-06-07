import { useMutation } from '@tanstack/react-query'

export type AddToHistoryInput = {
  userId: string
  recipe: Record<string, unknown>
}

async function addToHistory(input: AddToHistoryInput): Promise<void> {
  await fetch('/api/user/saved-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function useAddToHistory() {
  return useMutation({ mutationFn: addToHistory })
}
