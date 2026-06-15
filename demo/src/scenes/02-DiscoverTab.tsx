import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import {
  MAYA,
  MAYA_TASTE_PROFILE,
  MAYA_TRENDING_FOR_YOU,
  MAYA_MOST_LOVED,
  GLOBAL_TRENDING,
  TRENDING_PAIRINGS,
} from '../mock/maya'
import { theme } from '../theme'

// ─── Timing (frames at 30 fps, total 750 = 25 s) ─────────────────────────────
const FADE_IN        = 40   // scene fades in
const HOLD_TOP       = 160  // hold on taste profile
const SCROLL_START   = 160  // slow scroll begins
const SCROLL_END     = 560  // scroll finishes (all sections visible)
const HOLD_BOTTOM    = 750  // hold at bottom

// Total content height minus viewport height — calibrated to content below
const SCROLL_DISTANCE = 820

// ─── Shared sub-components (inline, no external deps) ────────────────────────

function SectionHeader({
  icon,
  label,
  iconColor = theme.primary,
}: {
  icon: React.ReactNode
  label: string
  iconColor?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>{icon}</div>
      <span style={{ fontSize: 14, fontWeight: 700, color: theme.foreground, letterSpacing: '0.01em' }}>
        {label}
      </span>
    </div>
  )
}

function Chip({
  label,
  variant = 'primary',
}: {
  label: string
  variant?: 'primary' | 'secondary' | 'amber' | 'violet'
}) {
  const styles: Record<string, { bg: string; color: string }> = {
    primary:   { bg: 'rgba(75,144,98,0.10)',   color: theme.primary },
    secondary: { bg: theme.secondary,           color: theme.foreground },
    amber:     { bg: 'rgba(245,158,11,0.10)',   color: '#b45309' },
    violet:    { bg: 'rgba(139,92,246,0.10)',   color: '#7c3aed' },
  }
  const { bg, color } = styles[variant]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  )
}

// ─── Taste profile card ───────────────────────────────────────────────────────

function TasteProfileCard() {
  const { preferred, avoided, flavourTerritory, formatSignals, signalCount } = MAYA_TASTE_PROFILE
  const rows = [
    { label: 'You love',         chips: preferred,        variant: 'primary'   as const },
    { label: 'You avoid',        chips: avoided,          variant: 'secondary' as const },
    { label: 'Flavour territory',chips: flavourTerritory, variant: 'amber'     as const },
    { label: 'Your preferences', chips: formatSignals,    variant: 'secondary' as const },
  ]
  return (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {rows.map(({ label, chips, variant }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span
            style={{
              fontSize: 12,
              color: theme.mutedFg,
              width: 120,
              flexShrink: 0,
              paddingTop: 6,
            }}
          >
            {label}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chips.map((c) => (
              <Chip key={c} label={c} variant={variant} />
            ))}
          </div>
        </div>
      ))}
      <p style={{ fontSize: 12, color: theme.mutedFg, margin: 0 }}>
        Based on {signalCount} feedback signals
      </p>
    </div>
  )
}

// ─── Recipe suggestion cards ──────────────────────────────────────────────────

function SuggestedForYou() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {MAYA_TASTE_PROFILE.recipeSuggestions.map((s, i) => (
        <div
          key={i}
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: 14,
            padding: '14px 18px',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: theme.foreground, margin: '0 0 4px', lineHeight: 1.4 }}>
            {s.direction}
          </p>
          <p style={{ fontSize: 12, color: theme.mutedFg, margin: 0, lineHeight: 1.5 }}>
            {s.reasoning}
          </p>
          {s.noveltyNote && (
            <p style={{ fontSize: 11, color: theme.mutedFg, opacity: 0.7, margin: '6px 0 0' }}>
              ··· {s.noveltyNote}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Most loved bar chart ─────────────────────────────────────────────────────

function MostLoved({ revealProgress }: { revealProgress: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {MAYA_MOST_LOVED.map((ing, i) => {
        const barProgress = interpolate(
          revealProgress,
          [i * 0.12, i * 0.12 + 0.4],
          [0, ing.score],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
        return (
          <div key={ing.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 13,
                color: theme.foreground,
                width: 130,
                flexShrink: 0,
                textTransform: 'capitalize',
              }}
            >
              {ing.key}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                background: theme.secondary,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.round(barProgress * 100)}%`,
                  background: '#fb7185', // rose-400
                  borderRadius: 999,
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: theme.mutedFg, width: 36, textAlign: 'right' }}>
              {Math.round(barProgress * 100)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── SVG icons (inline, no lucide import) ─────────────────────────────────────

const IconSparkles = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
  </svg>
)
const IconChefHat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/>
    <path d="M6 17h12"/>
  </svg>
)
const IconTrendingUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
)
const IconGlobe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.mutedFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
  </svg>
)
const IconHeart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
)
const IconWine = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H4c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>
  </svg>
)

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Kitchen',     active: false },
  { label: 'Recipe',      active: false },
  { label: 'Discover',    active: true  },
  { label: 'Substitutes', active: false },
  { label: 'Saved',       active: false },
]

function Sidebar() {
  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        height: '100%',
        background: theme.card,
        borderRight: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 0',
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 20px 28px',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: theme.primaryAlpha8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, color: theme.foreground }}>Fable</span>
      </div>

      {/* Nav items */}
      <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV_ITEMS.map(({ label, active }) => (
          <div
            key={label}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: active ? theme.primaryAlpha8 : 'transparent',
              color: active ? theme.primary : theme.mutedFg,
              fontSize: 14,
              fontWeight: active ? 700 : 500,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* User chip */}
      <div
        style={{
          margin: '0 12px',
          padding: '10px 12px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: theme.primaryAlpha25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: theme.primary,
            flexShrink: 0,
          }}
        >
          M
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: theme.foreground, margin: 0 }}>Maya</p>
          <p style={{ fontSize: 11, color: theme.mutedFg, margin: 0 }}>Gluten-free · Dairy-free</p>
        </div>
      </div>
    </div>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export function DiscoverTabScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: 'clamp' })

  // Smooth eased scroll — slow start, gentle arrival
  const scrollY = interpolate(
    frame,
    [SCROLL_START, SCROLL_END],
    [0, SCROLL_DISTANCE],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    }
  )

  // Most loved bars grow in when that section scrolls into view (~450px scroll)
  const mostLovedReveal = interpolate(scrollY, [360, 560], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Content viewport height
  const VIEWPORT_H = 1080

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: theme.background,
        display: 'flex',
        fontFamily: theme.fontFamily,
        opacity,
      }}
    >
      <Sidebar />

      {/* Main content — clipped viewport with scrolling inner */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Page title */}
        <div
          style={{
            padding: '28px 48px 0',
            borderBottom: `1px solid ${theme.border}`,
            marginBottom: 0,
          }}
        >
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: theme.foreground,
              margin: '0 0 20px',
              letterSpacing: '-0.02em',
            }}
          >
            Discover
          </h1>
        </div>

        {/* Scrolling content */}
        <div
          style={{
            transform: `translateY(-${scrollY}px)`,
            padding: '32px 48px',
            maxWidth: 720,
            display: 'flex',
            flexDirection: 'column',
            gap: 36,
          }}
        >
          {/* Taste Profile */}
          <div>
            <SectionHeader icon={<IconSparkles />} label="Your taste profile" iconColor="#f59e0b" />
            <TasteProfileCard />
          </div>

          {/* Suggested for you */}
          <div>
            <SectionHeader icon={<IconChefHat />} label="Suggested for you" />
            <SuggestedForYou />
          </div>

          {/* Trending for you */}
          <div>
            <SectionHeader icon={<IconTrendingUp />} label="Trending for you" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MAYA_TRENDING_FOR_YOU.map((rt, i) => (
                <Chip
                  key={i}
                  label={`${rt.cuisine} · ${rt.occasion.replace(/-/g, ' ')}`}
                  variant="primary"
                />
              ))}
            </div>
          </div>

          {/* Trending globally */}
          <div>
            <SectionHeader icon={<IconGlobe />} label="Trending globally" iconColor={theme.mutedFg} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {GLOBAL_TRENDING.map((ing) => (
                <Chip key={ing.key} label={ing.key} variant="secondary" />
              ))}
            </div>
          </div>

          {/* Most loved */}
          <div>
            <SectionHeader icon={<IconHeart />} label="Most loved" iconColor="#f43f5e" />
            <MostLoved revealProgress={mostLovedReveal} />
          </div>

          {/* Trending pairings */}
          <div>
            <SectionHeader icon={<IconWine />} label="Trending pairings" iconColor="#8b5cf6" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TRENDING_PAIRINGS.map((p, i) => (
                <Chip key={i} label={`${p.beverage} with ${p.recipeType}`} variant="violet" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
