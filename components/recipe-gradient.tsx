'use client'

import { cn } from '@/lib/utils'

// All colours are inline styles so Tailwind scanning can't drop them.
// Only structural utilities (position, size, blur, border-radius) use Tailwind.

type Blob = {
  color: string   // rgba string
  blur: string    // px value for filter: blur()
  top?: string; right?: string; bottom?: string; left?: string
  width: string; height: string
}

type Preset = {
  background: string   // full CSS gradient string
  blobs: Blob[]
}

const GRADIENTS: Preset[] = [
  // 0 — Amber harvest: warm amber → burnt orange → deep rose
  {
    background: 'linear-gradient(135deg, #78350f 0%, #c2410c 45%, #9f1239 100%)',
    blobs: [
      { color: 'rgba(251,191,36,0.32)',  blur: '40px', top: '-24px', right: '-24px', width: '144px', height: '144px' },
      { color: 'rgba(253,186,116,0.25)', blur: '28px', top: '20px',  left: '14px',   width: '80px',  height: '80px'  },
      { color: 'rgba(251,113,133,0.22)', blur: '32px', bottom: '-14px', right: '28px', width: '112px', height: '112px' },
    ],
  },
  // 1 — Herb garden: deep emerald → teal → midnight cyan
  {
    background: 'linear-gradient(135deg, #064e3b 0%, #0d9488 50%, #155e75 100%)',
    blobs: [
      { color: 'rgba(52,211,153,0.28)',  blur: '44px', top: '-28px', left: '-20px',  width: '160px', height: '160px' },
      { color: 'rgba(94,234,212,0.22)', blur: '28px', top: '14px',  right: '20px',  width: '96px',  height: '96px'  },
      { color: 'rgba(34,211,238,0.20)', blur: '40px', bottom: '-20px', right: '6px', width: '128px', height: '128px' },
    ],
  },
  // 2 — Spiced red: crimson → burnt orange → amber
  {
    background: 'linear-gradient(135deg, #7f1d1d 0%, #c2410c 50%, #b45309 100%)',
    blobs: [
      { color: 'rgba(248,113,113,0.32)', blur: '40px', top: '-14px', right: '20px',  width: '128px', height: '128px' },
      { color: 'rgba(253,186,116,0.26)', blur: '28px', bottom: '6px', left: '6px',   width: '96px',  height: '96px'  },
      { color: 'rgba(251,191,36,0.20)',  blur: '20px', top: '6px',  left: '36px',    width: '64px',  height: '64px'  },
    ],
  },
  // 3 — Plum & fig: midnight purple → violet → deep rose
  {
    background: 'linear-gradient(135deg, #3b0764 0%, #6d28d9 50%, #881337 100%)',
    blobs: [
      { color: 'rgba(192,132,252,0.28)', blur: '44px', top: '-24px', right: '-14px', width: '160px', height: '160px' },
      { color: 'rgba(196,181,253,0.22)', blur: '32px', bottom: '-4px', left: '-14px', width: '112px', height: '112px' },
      { color: 'rgba(251,113,133,0.20)', blur: '28px', top: '28px', left: '28px',    width: '64px',  height: '64px'  },
    ],
  },
  // 4 — Forest: deep green → emerald → dark teal
  {
    background: 'linear-gradient(135deg, #14532d 0%, #047857 50%, #134e4a 100%)',
    blobs: [
      { color: 'rgba(74,222,128,0.26)',  blur: '40px', top: '-14px', left: '-14px',  width: '128px', height: '128px' },
      { color: 'rgba(110,231,183,0.22)', blur: '44px', bottom: '-20px', right: '14px', width: '144px', height: '144px' },
      { color: 'rgba(45,212,191,0.22)',  blur: '28px', top: '20px', right: '20px',   width: '80px',  height: '80px'  },
    ],
  },
]

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

export function RecipeGradient({ title, className, children }: RecipeGradientProps) {
  const g = GRADIENTS[gradientIndex(title)]

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* base gradient — inline style so it's never dropped by Tailwind scanning */}
      <div className="absolute inset-0" style={{ background: g.background }} />

      {/* decorative blobs */}
      {g.blobs.map((blob, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            backgroundColor: blob.color,
            filter: `blur(${blob.blur})`,
            top: blob.top,
            right: blob.right,
            bottom: blob.bottom,
            left: blob.left,
            width: blob.width,
            height: blob.height,
          }}
        />
      ))}

      {/* legibility veil — bottom-heavy dark gradient for text overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)' }}
      />

      {children}
    </div>
  )
}
