import { Composition } from 'remotion'
import { AllergenPickerScene } from './scenes/01-AllergenPicker'

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
    </>
  )
}
