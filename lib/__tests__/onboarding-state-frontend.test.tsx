/**
 * @jest-environment jsdom
 *
 * Frontend tests for onboarding state persistence.
 *
 * Tests what the fable-context does with the onboardingComplete field returned
 * by the profile GET, and what completeTutorial() does for guest vs auth users.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { FableProvider, useFable } from '../../lib/fable-context'
import { TUTORIAL_COMPLETE_KEY, shouldShowTutorial } from '../tutorial'

// ─── Session — mutable so each test can control sign-in state ─────────────────

const session = { data: null as { user: { id: string } } | null, isPending: false }

jest.mock('@/lib/auth-client', () => ({
  useSession: () => session,
}))

// ─── localStorage ─────────────────────────────────────────────────────────────

let store: Record<string, string> = {}

Object.defineProperty(global, 'window', { value: global, writable: true, configurable: true })
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  },
  writable: true,
  configurable: true,
})

Object.defineProperty(global, 'crypto', {
  value: { randomUUID: () => 'test-user-id' },
  writable: true,
  configurable: true,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fakeResponse(data: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(data) } as Response
}

function mockFetch(profileOverrides: Record<string, unknown> = {}) {
  global.fetch = jest.fn((url: unknown, opts?: RequestInit) => {
    const u = String(url)
    const method = opts?.method ?? 'GET'
    if (u.includes('/api/user/profile') && method === 'GET') {
      return Promise.resolve(fakeResponse({
        allergens: [],
        customAllergens: [],
        ingredients: [],
        safeIngredients: [],
        safeFoodsMode: false,
        showMacros: false,
        activePresets: [],
        lactoseIntolerant: false,
        lactoseMode: 'include',
        kitchenEquipment: ['hob', 'oven'],
        darkMode: false,
        ...profileOverrides,
      }))
    }
    if (u.includes('/api/user/saved-recipes')) return Promise.resolve(fakeResponse({ recipes: [] }))
    if (u.includes('/api/user/collections')) return Promise.resolve(fakeResponse({ collections: [] }))
    return Promise.resolve(fakeResponse({ ok: true }))
  }) as jest.MockedFunction<typeof fetch>
}

// Probe captures the context value on every render — no useEffect needed.
let capturedCtx: ReturnType<typeof useFable> | null = null
function Probe() {
  capturedCtx = useFable()
  return null
}

async function renderWithContext(profileOverrides: Record<string, unknown> = {}) {
  capturedCtx = null
  mockFetch(profileOverrides)

  await act(async () => {
    render(
      <FableProvider>
        <Probe />
      </FableProvider>
    )
  })

  await waitFor(() => {
    expect(capturedCtx?.isLoadingProfile).toBe(false)
  }, { timeout: 3000 })
}

beforeEach(() => {
  // Seed a userId so loadProfile is called (rather than the "new user" early-exit path)
  store = { fable_user_id: 'test-user-id' }
  session.data = null
  session.isPending = false
  jest.clearAllMocks()
})

// ─── Profile load sets localStorage ──────────────────────────────────────────

describe('onboarding state — profile load', () => {
  it('sets the tutorial complete flag when profile returns onboardingComplete: true', async () => {
    session.data = { user: { id: 'auth-user-id' } }
    await renderWithContext({ onboardingComplete: true })

    expect(store[TUTORIAL_COMPLETE_KEY]).toBe('true')
    expect(shouldShowTutorial()).toBe(false)
  })

  it('does NOT set the tutorial flag when profile returns onboardingComplete: false', async () => {
    session.data = { user: { id: 'auth-user-id' } }
    await renderWithContext({ onboardingComplete: false })

    expect(store[TUTORIAL_COMPLETE_KEY]).toBeUndefined()
    expect(shouldShowTutorial()).toBe(true)
  })

  it('does NOT set the tutorial flag when onboardingComplete is absent from profile', async () => {
    session.data = { user: { id: 'auth-user-id' } }
    await renderWithContext({}) // no onboardingComplete key

    expect(store[TUTORIAL_COMPLETE_KEY]).toBeUndefined()
    expect(shouldShowTutorial()).toBe(true)
  })
})

// ─── completeTutorial() — localStorage ───────────────────────────────────────

describe('onboarding state — completeTutorial() sets localStorage', () => {
  it('sets the tutorial complete flag for guest users', async () => {
    session.data = null // guest
    await renderWithContext()

    await act(async () => { capturedCtx!.completeTutorial() })

    expect(store[TUTORIAL_COMPLETE_KEY]).toBe('true')
    expect(shouldShowTutorial()).toBe(false)
  })

  it('sets the tutorial complete flag for authenticated users', async () => {
    session.data = { user: { id: 'auth-user-id' } }
    await renderWithContext()

    await act(async () => { capturedCtx!.completeTutorial() })

    expect(store[TUTORIAL_COMPLETE_KEY]).toBe('true')
    expect(shouldShowTutorial()).toBe(false)
  })
})

// ─── completeTutorial() — PATCH for auth users only ──────────────────────────

describe('onboarding state — completeTutorial() fires PATCH for auth users only', () => {
  it('fires PATCH /api/user/profile with onboardingComplete: true for authenticated users', async () => {
    session.data = { user: { id: 'auth-user-id' } }
    await renderWithContext()

    await act(async () => { capturedCtx!.completeTutorial() })

    const calls = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls
    const patchCall = calls.find(
      ([url, opts]) =>
        String(url).includes('/api/user/profile') &&
        (opts as RequestInit)?.method === 'PATCH'
    )
    expect(patchCall).toBeDefined()
    const body = JSON.parse((patchCall![1] as RequestInit).body as string)
    expect(body.onboardingComplete).toBe(true)
  })

  it('does NOT fire PATCH for guest users', async () => {
    session.data = null // guest
    await renderWithContext()

    await act(async () => { capturedCtx!.completeTutorial() })

    const calls = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls
    const patchCall = calls.find(
      ([url, opts]) =>
        String(url).includes('/api/user/profile') &&
        (opts as RequestInit)?.method === 'PATCH'
    )
    expect(patchCall).toBeUndefined()
  })
})
