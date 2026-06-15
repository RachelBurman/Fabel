import { Composition } from 'remotion'
import { AllergenPickerScene } from './scenes/01-AllergenPicker'
import { DiscoverTabScene } from './scenes/02-DiscoverTab'

export function Root() {
  return (
    <>
      {/* 01 — Intro / Allergen picker  (10 s) */}
      <Composition
        id="AllergenPicker"
        component={AllergenPickerScene}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 02 — Maya · Discover tab  (25 s) */}
      <Composition
        id="DiscoverTab"
        component={DiscoverTabScene}
        durationInFrames={750}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  )
}
