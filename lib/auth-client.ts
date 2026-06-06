'use client'

// Direct HTTP client for Better Auth — avoids importing better-auth/react,
// which calls React.useRef at module-init time and crashes Next.js prerendering.

const BASE = '/api/auth'

interface SessionUser {
  id: string
  name: string
  email: string
}

interface SessionData {
  user: SessionUser
}

// ── Shared reactive session state ─────────────────────────────────────────────

let _cache: SessionData | null = null
let _pending = true
let _fetched = false
let _listeners: Array<() => void> = []

function notify() { _listeners.forEach(fn => fn()) }

async function fetchSession() {
  if (_fetched) return
  _fetched = true
  try {
    const res = await fetch(`${BASE}/get-session`, { credentials: 'include' })
    _cache = res.ok ? await res.json() as SessionData : null
  } catch {
    _cache = null
  }
  _pending = false
  notify()
}

async function invalidate() {
  _cache = null
  _pending = true
  _fetched = false
  await fetchSession()
}

// Start fetching immediately in the browser — no-op on the server
if (typeof window !== 'undefined') {
  void fetchSession()
}

// ── useSession ────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'

export function useSession() {
  const [, tick] = useState(0)

  useEffect(() => {
    const listener = () => tick(n => n + 1)
    _listeners.push(listener)
    // If the fetch completed before this component mounted, fire immediately
    if (!_pending) tick(n => n + 1)
    return () => { _listeners = _listeners.filter(l => l !== listener) }
  }, [])

  return { data: _cache, isPending: _pending }
}

// ── signIn ────────────────────────────────────────────────────────────────────

export const signIn = {
  email: async ({ email, password }: {
    email: string; password: string; callbackURL?: string
  }) => {
    const res = await fetch(`${BASE}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({})) as Record<string, string>
    if (!res.ok) return { data: null, error: { message: data.message ?? data.error ?? 'Sign in failed' } }
    await invalidate()
    return { data, error: null }
  },
}

// ── signUp ────────────────────────────────────────────────────────────────────

export const signUp = {
  email: async ({ email, password, name }: {
    email: string; password: string; name: string; callbackURL?: string
  }) => {
    const res = await fetch(`${BASE}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include',
    })
    const data = await res.json().catch(() => ({})) as Record<string, string>
    if (!res.ok) return { data: null, error: { message: data.message ?? data.error ?? 'Sign up failed' } }
    await invalidate()
    return { data, error: null }
  },
}

// ── signOut ───────────────────────────────────────────────────────────────────

export async function signOut() {
  await fetch(`${BASE}/sign-out`, { method: 'POST', credentials: 'include' })
  _cache = null
  _pending = false
  _fetched = true
  notify()
}
