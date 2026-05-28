'use client'

import { cn } from '@/lib/utils'

// Five distinct food-themed gradient presets.
// All class names are static strings so Tailwind includes them at build time.
const GRADIENTS = [
  // 0 — Amber harvest: warm oranges and rose
  {
    gradient: 'bg-gradient-to-br from-amber-900 via-orange-600 to-rose-800',
    blobs: [
      'absolute -top-6 -right-6 w-36 h-36 rounded-full bg-amber-400/30 blur-2xl',
      'absolute top-6 left-4 w-20 h-20 rounded-full bg-orange-300/25 blur-xl',
      'absolute -bottom-4 right-8 w-28 h-28 rounded-full bg-rose-400/20 blur-xl',
    ],
  },
  // 1 — Herb garden: deep emerald and teal
  {
    gradient: 'bg-gradient-to-br from-emerald-900 via-teal-600 to-cyan-800',
    blobs: [
      'absolute -top-8 -left-6 w-40 h-40 rounded-full bg-emerald-400/25 blur-2xl',
      'absolute top-4 right-6 w-24 h-24 rounded-full bg-teal-300/20 blur-xl',
      'absolute -bottom-6 right-2 w-32 h-32 rounded-full bg-cyan-400/20 blur-2xl',
    ],
  },
  // 2 — Spiced red: deep reds and amber
  {
    gradient: 'bg-gradient-to-br from-red-900 via-orange-700 to-amber-700',
    blobs: [
      'absolute -top-4 right-6 w-32 h-32 rounded-full bg-red-400/30 blur-2xl',
      'absolute bottom-2 left-2 w-24 h-24 rounded-full bg-orange-300/25 blur-xl',
      'absolute top-2 left-10 w-16 h-16 rounded-full bg-amber-400/20 blur-lg',
    ],
  },
  // 3 — Plum & fig: purple and rose
  {
    gradient: 'bg-gradient-to-br from-purple-900 via-violet-700 to-rose-900',
    blobs: [
      'absolute -top-6 -right-4 w-40 h-40 rounded-full bg-purple-400/25 blur-2xl',
      'absolute bottom-0 -left-4 w-28 h-28 rounded-full bg-violet-300/20 blur-xl',
      'absolute top-8 left-8 w-16 h-16 rounded-full bg-rose-400/20 blur-xl',
    ],
  },
  // 4 — Forest: deep green and teal
  {
    gradient: 'bg-gradient-to-br from-green-900 via-emerald-700 to-teal-800',
    blobs: [
      'absolute -top-4 -left-4 w-32 h-32 rounded-full bg-green-400/25 blur-2xl',
      'absolute -bottom-6 right-4 w-36 h-36 rounded-full bg-emerald-300/20 blur-2xl',
      'absolute top-6 right-6 w-20 h-20 rounded-full bg-teal-400/20 blur-xl',
    ],
  },
] as const

export function gradientIndex(title: string): number {
  const hash = title.split('').reduce(
    (h, ch) => ((h * 31 + ch.charCodeAt(0)) & 0x7fffffff),
    0
  )
  return hash % GRADIENTS.length
}

interface RecipeGradientProps {
  title: string
  className?: string
  children?: React.ReactNode
}

// Renders the colourful base gradient + decorative blobs + a bottom-to-transparent
// dark veil for text legibility. Overlay your own content as children.
export function RecipeGradient({ title, className, children }: RecipeGradientProps) {
  const g = GRADIENTS[gradientIndex(title)]
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* base gradient */}
      <div className={cn('absolute inset-0', g.gradient)} />
      {/* decorative blobs */}
      {g.blobs.map((b, i) => <div key={i} className={b} />)}
      {/* legibility veil */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      {children}
    </div>
  )
}
