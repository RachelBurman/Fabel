import { useMutation } from '@tanstack/react-query'

export type CreateCollectionInput = {
  userId: string
  collectionId: string
  name: string
}

async function createCollection(input: CreateCollectionInput): Promise<void> {
  await fetch('/api/user/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function useCreateCollection() {
  return useMutation({ mutationFn: createCollection })
}
