'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { signIn, signUp } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'

interface AuthFormProps {
  onSuccess?: () => void
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    if (mode === 'signup' && name.length > 50) {
      setError('Name must be 50 characters or fewer')
      return
    }
    if (email.length > 254) {
      setError('Email must be 254 characters or fewer')
      return
    }
    if (password.length > 72) {
      setError('Password must be 72 characters or fewer')
      return
    }
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error: e } = await signIn.email({ email, password })
        if (e) { setError(e.message ?? 'Sign in failed'); return }
      } else {
        const { error: e } = await signUp.email({ email, password, name })
        if (e) { setError(e.message ?? 'Sign up failed'); return }
      }
      onSuccess?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">
        {mode === 'signin' ? 'Sign in to Fable' : 'Create your account'}
      </p>

      {mode === 'signup' && (
        <Input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={loading}
          autoComplete="name"
          className="h-9 text-sm"
        />
      )}
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={loading}
        autoComplete="email"
        className="h-9 text-sm"
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        disabled={loading}
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSubmit() }}
        className="h-9 text-sm"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>

      <p className="text-xs text-center text-muted-foreground">
        {mode === 'signin' ? (
          <>
            Don&apos;t have an account?{' '}
            <button
              onClick={() => { setMode('signup'); setError(null) }}
              className="underline hover:text-foreground transition-colors"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              onClick={() => { setMode('signin'); setError(null) }}
              className="underline hover:text-foreground transition-colors"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  )
}
