'use client'

import { toast } from 'sonner'
import { type GeneratedRecipe } from './types'

export async function shareRecipe(recipeId: string, recipe: GeneratedRecipe): Promise<void> {
  const res = await fetch('/api/recipe-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeId, recipe }),
  })

  if (!res.ok) {
    toast.error('Could not create share link. Please try again.')
    return
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/recipe/${recipeId}`

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: recipe.title, url: shareUrl })
    } catch {
      // User cancelled — not an error
    }
  } else {
    await navigator.clipboard.writeText(shareUrl)
    toast.success('Link copied to clipboard')
  }
}
