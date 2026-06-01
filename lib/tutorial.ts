export const TUTORIAL_COMPLETE_KEY = 'fable-onboarding-complete'
export const TUTORIAL_SLIDE_COUNT = 5

export function shouldShowTutorial(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(TUTORIAL_COMPLETE_KEY) === null
}

export function markTutorialComplete(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TUTORIAL_COMPLETE_KEY, 'true')
}

export function clearTutorialComplete(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TUTORIAL_COMPLETE_KEY)
}
