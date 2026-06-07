import { useMutation } from '@tanstack/react-query'
import { type RecipeMacros } from '@/lib/types'

export type MacrosInput = {
  title: string
  ingredients: unknown[]
  servings: number
  userId?: string
}

export type MacrosResult = {
  macros?: RecipeMacros
  resetAt?: string
  error?: string
}

async function fetchMacros(input: MacrosInput): Promise<MacrosResult> {
  const res = await fetch('/api/macros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (res.status === 429) {
    const data = await res.json().catch(() => ({})) as { resetAt?: string }
    return { resetAt: data.resetAt, error: 'rate_limited' }
  }
  if (!res.ok) return {}
  const data = await res.json() as RecipeMacros
  return { macros: data }
}

export function useMacros() {
  return useMutation({ mutationFn: fetchMacros })
}
