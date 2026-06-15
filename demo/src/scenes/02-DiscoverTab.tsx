// Imports the real DiscoverSection component.
// next-intl, @/lib/fable-context, and @/lib/hooks/use-insights are replaced
// with mocks via webpack aliases in remotion.config.ts so no API calls are made.
import '../../src/styles.css'
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
// @ts-ignore — @/ resolved by webpack alias in remotion.config.ts, not tsc
import { DiscoverSection } from '@/components/discover-section'
import { FableProvider } from '../mocks/fable-context'
import { MAYA } from '../mock/maya'
import { theme } from '../theme'

// ─── Timing (30 fps, 750 frames = 25 s) ──────────────────────────────────────
const FADE_IN       = 40
const SCROLL_START  = 160
const SCROLL_END    = 600
const SCROLL_PX     = 900   // tune after first render if content is taller/shorter

// ─── Sidebar (matches the real SidebarNavigation layout) ─────────────────────
const NAV_ITEMS = [
  { label: 'Kitchen',     active: false },
  { label: 'Recipe',      active: false },
  { label: 'Discover',    active: true  },
  { label: 'Substitutes', active: false },
  { label: 'Saved',       active: false },
]

function DemoSidebar() {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        height: '100%',
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 0',
        fontFamily: theme.fontFamily,
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 20px 24px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(75,144,98,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)' }}>Fable</span>
      </div>

      {/* Nav */}
      <div style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ label, active }) => (
          <div
            key={label}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: active ? 'rgba(75,144,98,0.10)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--muted-foreground)',
              fontSize: 14,
              fontWeight: active ? 700 : 500,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Maya user chip */}
      <div
        style={{
          margin: '0 12px',
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
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
            background: 'rgba(75,144,98,0.20)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--primary)',
            flexShrink: 0,
          }}
        >
          M
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            {MAYA.name}
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>
            {MAYA.allergens.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(' · ')}-free
          </p>
        </div>
      </div>
    </aside>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export function DiscoverTabScene() {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: 'clamp' })

  const scrollY = interpolate(
    frame,
    [SCROLL_START, SCROLL_END],
    [0, SCROLL_PX],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    }
  )

  return (
    // FableProvider supplies the mocked useFable context the real component calls
    <FableProvider>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--background)',
          display: 'flex',
          opacity,
          fontFamily: theme.fontFamily,
        }}
      >
        <DemoSidebar />

        {/* Clipped viewport — inner content scrolls via translateY */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div style={{ transform: `translateY(-${scrollY}px)` }}>
            {/* The actual DiscoverSection from the app */}
            <DiscoverSection />
          </div>
        </div>
      </div>
    </FableProvider>
  )
}
