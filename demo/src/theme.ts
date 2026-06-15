// Matches the app's light-mode CSS variables (globals.css :root)
// oklch values approximated to hex for use in inline styles
export const theme = {
  background:        '#f6f4ee', // oklch(0.97 0.01 90)
  card:              '#fefdfa', // oklch(0.995 0.005 90)
  foreground:        '#3d3025', // oklch(0.25 0.02 60)
  primary:           '#4b9062', // oklch(0.55 0.12 145)
  primaryFg:         '#fcfaf7', // oklch(0.99 0.005 90)
  primaryAlpha8:     'rgba(75,144,98,0.08)',
  primaryAlpha25:    'rgba(75,144,98,0.25)',
  border:            '#e0d8cc', // oklch(0.88 0.015 80)
  mutedFg:           '#7a6f66', // oklch(0.50 0.02 60)
  secondary:         '#ece7de', // oklch(0.92 0.02 80)
  radius:            '12px',
  fontFamily:        "'DM Sans', system-ui, sans-serif",
}
