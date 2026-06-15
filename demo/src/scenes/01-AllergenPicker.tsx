import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { ALLERGENS, DEMO_SELECTED } from '../mock/allergens'
import { theme } from '../theme'

// ─── Timing (frames at 30 fps) ────────────────────────────────────────────────
const FADE_IN        = 20   // screen fades in
const CARDS_START    = 30   // first card appears
const CARD_SPACING   = 10   // frames between each card entrance
const SELECT_START   = 220  // first card gets selected
const SELECT_SPACING = 18   // frames between each selection
const FOOTER_IN      = SELECT_START + DEMO_SELECTED.length * SELECT_SPACING + 10

// ─── AllergenCard ─────────────────────────────────────────────────────────────

function AllergenCard({
  allergen,
  index,
  frame,
  fps,
}: {
  allergen: (typeof ALLERGENS)[number]
  index: number
  frame: number
  fps: number
}) {
  const isSelected = DEMO_SELECTED.includes(allergen.id)
  const selectIndex = DEMO_SELECTED.indexOf(allergen.id)
  const selectFrame = SELECT_START + selectIndex * SELECT_SPACING

  // Entrance: fade + scale up
  const entryStart = CARDS_START + index * CARD_SPACING
  const entryProgress = interpolate(frame, [entryStart, entryStart + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Selection: spring scale pulse when the card gets ticked
  const selectedNow = isSelected && frame >= selectFrame
  const selectProgress = isSelected
    ? interpolate(frame, [selectFrame, selectFrame + 14], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0

  const checkScale = isSelected
    ? spring({ frame: frame - selectFrame, fps, config: { damping: 10, stiffness: 200 } })
    : 0

  return (
    <div
      style={{
        opacity: entryProgress,
        transform: `scale(${interpolate(entryProgress, [0, 1], [0.82, 1])})`,
        aspectRatio: '1',
        background: selectedNow
          ? `rgba(75,144,98,${interpolate(selectProgress, [0, 1], [0, 0.07])})`
          : theme.card,
        border: `2px solid ${
          selectedNow
            ? `rgba(75,144,98,${interpolate(selectProgress, [0, 1], [0.1, 1])})`
            : theme.border
        }`,
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        position: 'relative' as const,
      }}
    >
      {/* Check badge */}
      {selectedNow && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: theme.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${checkScale})`,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke={theme.primaryFg}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      <span style={{ fontSize: 36, lineHeight: 1 }}>{allergen.icon}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: selectedNow ? theme.primary : theme.foreground,
          textAlign: 'center',
          lineHeight: 1.2,
          letterSpacing: '0.01em',
        }}
      >
        {allergen.name}
      </span>
    </div>
  )
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export function AllergenPickerScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const screenOpacity = interpolate(frame, [0, FADE_IN], [0, 1], {
    extrapolateRight: 'clamp',
  })

  const headerY = interpolate(frame, [0, FADE_IN + 10], [18, 0], {
    extrapolateRight: 'clamp',
  })

  const footerOpacity = interpolate(frame, [FOOTER_IN, FOOTER_IN + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const selectedCount = DEMO_SELECTED.filter(
    (id) => frame >= SELECT_START + DEMO_SELECTED.indexOf(id) * SELECT_SPACING
  ).length

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: theme.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.fontFamily,
        opacity: screenOpacity,
      }}
    >
      {/* Content panel — matches max-w-2xl centred layout from the app */}
      <div style={{ width: 860, display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 40,
            transform: `translateY(${headerY}px)`,
          }}
        >
          <h2
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: theme.foreground,
              margin: '0 0 10px',
              letterSpacing: '-0.02em',
            }}
          >
            What are you allergic to?
          </h2>
          <p style={{ fontSize: 17, color: theme.mutedFg, margin: 0 }}>
            Select all that apply — you can change this any time in Settings.
          </p>
        </div>

        {/* EU Big 14 grid — 7 cols matches md:grid-cols-7 in OnboardingScreen */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 10,
            marginBottom: 28,
          }}
        >
          {ALLERGENS.map((allergen, index) => (
            <AllergenCard
              key={allergen.id}
              allergen={allergen}
              index={index}
              frame={frame}
              fps={fps}
            />
          ))}
        </div>

        {/* Footer — matches the Continue row in the real component */}
        <div
          style={{
            opacity: footerOpacity,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            paddingTop: 24,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          <span style={{ fontSize: 15, color: theme.mutedFg }}>
            {selectedCount === 0
              ? 'No allergens selected'
              : `${selectedCount} allergen${selectedCount !== 1 ? 's' : ''} selected`}
          </span>
          <div
            style={{
              background: theme.primary,
              color: theme.primaryFg,
              borderRadius: 999,
              padding: '13px 36px',
              fontSize: 16,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Continue
            <span style={{ fontSize: 18 }}>→</span>
          </div>
        </div>
      </div>
    </div>
  )
}
