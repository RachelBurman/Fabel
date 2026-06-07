import { useMutation } from '@tanstack/react-query'

export type DeleteCollectionInput = {
  collectionId: string
  userId: string
}

async function deleteCollection({ collectionId, userId }: DeleteCollectionInput): Promise<void> {
  await fetch(
    `/api/user/collections/${encodeURIComponent(collectionId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  )
}

export function useDeleteCollection() {
  return useMutation({ mutationFn: deleteCollection })
}
