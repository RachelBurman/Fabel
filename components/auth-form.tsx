'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { signIn, signUp } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('auth')

  const handleSubmit = async () => {
    setError(null)
    if (mode === 'signup' && name.length > 50) {
      setError(t('nameTooLong'))
      return
    }
    if (email.length > 254) {
      setError(t('emailTooLong'))
      return
    }
    if (password.length > 72) {
      setError(t('passwordTooLong'))
      return
    }
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error: e } = await signIn.email({ email, password })
        if (e) { setError(e.message ?? t('signInFailed')); return }
      } else {
        const { error: e } = await signUp.email({ email, password, name })
        if (e) { setError(e.message ?? t('signUpFailed')); return }
      }
      onSuccess?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">
        {mode === 'signin' ? t('signIn') : t('signUp')}
      </p>

      {mode === 'signup' && (
        <Input
          type="text"
          placeholder={t('name')}
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={loading}
          autoComplete="name"
          className="h-9 text-sm"
        />
      )}
      <Input
        type="email"
        placeholder={t('email')}
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={loading}
        autoComplete="email"
        className="h-9 text-sm"
      />
      <Input
        type="password"
        placeholder={t('password')}
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
        {loading ? (mode === 'signin' ? t('signingIn') : t('signingUp')) : (mode === 'signin' ? t('signIn') : t('createAccount'))}
      </button>

      <p className="text-xs text-center text-muted-foreground">
        {mode === 'signin' ? (
          <>
            {t('dontHaveAccount')}{' '}
            <button
              onClick={() => { setMode('signup'); setError(null) }}
              className="underline hover:text-foreground transition-colors"
            >
              {t('signUp')}
            </button>
          </>
        ) : (
          <>
            {t('alreadyHaveAccount')}{' '}
            <button
              onClick={() => { setMode('signin'); setError(null) }}
              className="underline hover:text-foreground transition-colors"
            >
              {t('signIn')}
            </button>
          </>
        )}
      </p>
    </div>
  )
}
