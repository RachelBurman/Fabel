// Minimal mock for next-intl — reads real English strings from messages/en.json
// so the real components render with actual copy, not key placeholders.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const messages = require('../../../messages/en.json') as Record<string, unknown>

type Params = Record<string, string | number>

function resolveDotPath(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template
  )
}

export function useTranslations(namespace: string) {
  const ns = (messages[namespace] ?? {}) as Record<string, unknown>
  return function t(key: string, params?: Params): string {
    const val = resolveDotPath(ns, key)
    return val !== undefined ? interpolate(val, params) : key
  }
}

// Stub — not used by DiscoverSection but exported so any transitive import works
export function useLocale() { return 'en' }
export function NextIntlClientProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

import React from 'react'
export default { useTranslations, useLocale, NextIntlClientProvider }
