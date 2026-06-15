// Stub — DiscoverSection doesn't use next/navigation directly but
// transitive imports from lib/auth-client may pull it in.
export function useRouter() { return { push: () => {}, replace: () => {}, back: () => {} } }
export function usePathname() { return '/' }
export function useSearchParams() { return new URLSearchParams() }
export function redirect() {}
