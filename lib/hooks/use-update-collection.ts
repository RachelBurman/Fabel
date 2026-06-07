import { useMutation } from '@tanstack/react-query'

export type UpdateCollectionInput = {
  collectionId: string
  userId: string
  recipeIds: string[]
}

async function updateCollection({ collectionId, userId, recipeIds }: UpdateCollectionInput): Promise<void> {
  await fetch(`/api/user/collections/${encodeURIComponent(collectionId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, recipeIds }),
  })
}

export function useUpdateCollection() {
  return useMutation({ mutationFn: updateCollection })
}
