import { shouldShowTutorial, markTutorialComplete, clearTutorialComplete, TUTORIAL_COMPLETE_KEY, TUTORIAL_SLIDE_COUNT } from '../tutorial'

// Make window available for the typeof window !== 'undefined' guards
Object.defineProperty(global, 'window', { value: global, writable: true, configurable: true })

let store: Record<string, string> = {}
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => { store[key] = value },
    removeItem: (key: string): void => { delete store[key] },
    clear: (): void => { store = {} },
  },
  writable: true,
  configurable: true,
})

beforeEach(() => { store = {} })

describe('shouldShowTutorial', () => {
  it('returns true when the flag is absent', () => {
    expect(shouldShowTutorial()).toBe(true)
  })

  it('returns false when the flag is present', () => {
    store[TUTORIAL_COMPLETE_KEY] = 'true'
    expect(shouldShowTutorial()).toBe(false)
  })
})

describe('markTutorialComplete', () => {
  it('sets the completion flag in localStorage', () => {
    markTutorialComplete()
    expect(store[TUTORIAL_COMPLETE_KEY]).toBe('true')
  })

  it('causes shouldShowTutorial to return false', () => {
    markTutorialComplete()
    expect(shouldShowTutorial()).toBe(false)
  })
})

describe('clearTutorialComplete', () => {
  it('removes the completion flag from localStorage', () => {
    store[TUTORIAL_COMPLETE_KEY] = 'true'
    clearTutorialComplete()
    expect(store[TUTORIAL_COMPLETE_KEY]).toBeUndefined()
  })

  it('causes shouldShowTutorial to return true', () => {
    store[TUTORIAL_COMPLETE_KEY] = 'true'
    clearTutorialComplete()
    expect(shouldShowTutorial()).toBe(true)
  })
})

describe('TUTORIAL_SLIDE_COUNT', () => {
  it('is 5', () => {
    expect(TUTORIAL_SLIDE_COUNT).toBe(5)
  })

  it('dot indicator indices run from 0 to TUTORIAL_SLIDE_COUNT - 1', () => {
    const dots = Array.from({ length: TUTORIAL_SLIDE_COUNT }, (_, i) => i)
    expect(dots[0]).toBe(0)
    expect(dots[TUTORIAL_SLIDE_COUNT - 1]).toBe(TUTORIAL_SLIDE_COUNT - 1)
    expect(dots.length).toBe(5)
  })
})
