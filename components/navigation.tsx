'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, BookOpen, Heart, Settings, Leaf, Clock, ShieldCheck, ArrowLeftRight, Moon, Sun, Monitor, User, X, Compass, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSession, signOut as authSignOut } from '@/lib/auth-client'
import { AuthForm } from '@/components/auth-form'
import { cn } from '@/lib/utils'
import { useFable } from '@/lib/fable-context'

type NavScreen = 'ingredients' | 'recipe' | 'discover' | 'substitutes' | 'saved' | 'history'

interface BottomNavigationProps {
  currentScreen: NavScreen
  onNavigate: (screen: NavScreen) => void
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
  const { preferences } = useFable()
  const visibleTabs = preferences.visibleTabs

  const allNavItems = [
    { id: 'ingredients'  as const, label: 'Kitchen',     icon: ChefHat,       tabKey: 'kitchen'     },
    { id: 'recipe'       as const, label: 'Recipe',      icon: BookOpen,      tabKey: 'recipe'      },
    { id: 'discover'     as const, label: 'Discover',    icon: Compass,       tabKey: 'discover'    },
    { id: 'substitutes'  as const, label: 'Substitutes', icon: ArrowLeftRight, tabKey: 'substitutes' },
    { id: 'history'      as const, label: 'History',     icon: Clock,         tabKey: 'history'     },
    { id: 'saved'        as const, label: 'Saved',       icon: Heart,         tabKey: 'saved'       },
  ]

  const navItems = allNavItems.filter(item => visibleTabs.includes(item.tabKey))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-pb md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map(item => {
          const isActive = currentScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex flex-col items-center justify-center w-full h-full transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-b-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className={cn('w-5 h-5 mb-1', isActive && 'text-primary')} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function SidebarNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
  const { preferences } = useFable()
  const visibleTabs = preferences.visibleTabs
  const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0

  const allNavItems = [
    { id: 'ingredients'  as const, label: 'Kitchen',     icon: ChefHat,        tabKey: 'kitchen'     },
    { id: 'recipe'       as const, label: 'Recipe',      icon: BookOpen,       tabKey: 'recipe'      },
    { id: 'discover'     as const, label: 'Discover',    icon: Compass,        tabKey: 'discover'    },
    { id: 'substitutes'  as const, label: 'Substitutes', icon: ArrowLeftRight, tabKey: 'substitutes' },
    { id: 'history'      as const, label: 'History',     icon: Clock,          tabKey: 'history'     },
    { id: 'saved'        as const, label: 'Saved',       icon: Heart,          tabKey: 'saved'       },
  ]

  const navItems = allNavItems.filter(item => visibleTabs.includes(item.tabKey))

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] flex-col bg-card/95 backdrop-blur-md border-r border-border z-50">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border shrink-0 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Leaf className="w-4 h-4 text-primary" />
        </div>
        <span className="text-lg font-semibold text-foreground truncate">Fable</span>
        {safeFoodsActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ml-auto"
            style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#15803d' }}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Safe</span>
          </motion.div>
        )}
      </div>
      <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
        {navItems.map(item => {
          const isActive = currentScreen === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-nav-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

interface HeaderProps {
  onSettingsClick?: () => void
}

export function Header({ onSettingsClick }: HeaderProps) {
  const { preferences, setColorMode } = useFable()
  const { setTheme } = useTheme()
  const { data: session, isPending } = useSession()
  const isSignedIn = !!session?.user
  const isLoaded = !isPending
  const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
  const colorMode = preferences.colorMode

  const [guestOpen, setGuestOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const rightGroupRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setIsMounted(true) }, [])

  const handleColorModeCycle = () => {
    const next = colorMode === 'light' ? 'dark' : colorMode === 'dark' ? 'system' : 'light'
    setTheme(next)
    setColorMode(next)
  }

  // Close popover on click outside the whole right button group
  useEffect(() => {
    if (!guestOpen) return
    const handler = (e: MouseEvent) => {
      if (rightGroupRef.current && !rightGroupRef.current.contains(e.target as Node)) {
        setGuestOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [guestOpen])

  // Close popover after successful sign-in
  useEffect(() => {
    if (isSignedIn && guestOpen) setGuestOpen(false)
  }, [isSignedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    localStorage.removeItem('fable-guest-migrated')
    localStorage.removeItem('fable-onboarding-complete')
    localStorage.setItem('fable_user_id', crypto.randomUUID())
    setGuestOpen(false)
    await authSignOut()
  }

  const displayName = isLoaded && isSignedIn
    ? (session?.user?.name?.split(' ')?.[0] || session?.user?.email?.split('@')[0] || 'Account').slice(0, 12)
    : 'Guest'

  const pillInitial = isLoaded && isSignedIn && session?.user?.name
    ? session.user.name[0].toUpperCase()
    : null

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-16 px-6 md:justify-end">

        {/* Left: logo + Safe Foods badge — hidden on desktop (sidebar shows the logo) */}
        <div className="flex items-center gap-2 min-w-0 flex-1 md:hidden">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Leaf className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-semibold text-foreground shrink-0">Fable</span>
          {safeFoodsActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
              style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#15803d' }}
            >
              <ShieldCheck className="w-3 h-3" />
              <span className="hidden xs:inline">Safe Foods</span>
            </motion.div>
          )}
        </div>

        {/* Right: user pill + dark mode + settings */}
        <div ref={rightGroupRef} className="relative flex items-center gap-1">

          {/* User / Guest pill */}
          <button
            onClick={() => setGuestOpen(v => !v)}
            aria-label={isSignedIn ? `${displayName} — account menu` : 'Guest mode — sign in'}
            aria-expanded={guestOpen}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              guestOpen
                ? 'bg-secondary/80 text-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            )}
          >
            {pillInitial
              ? <span className="w-3 h-3 flex items-center justify-center text-[10px] font-bold shrink-0">{pillInitial}</span>
              : <User className="w-3 h-3 shrink-0" />
            }
            <span className="hidden xs:inline">{displayName}</span>
            <span className="xs:hidden">{isSignedIn ? displayName : 'Guest'}</span>
          </button>

          {/* Auth popover */}
          <AnimatePresence>
            {guestOpen && isSignedIn && (
              /* ── Signed-in view ── */
              <motion.div
                key="user-menu"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute top-full right-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {session?.user?.name || session?.user?.email?.split('@')[0] || 'Account'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session?.user?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setGuestOpen(false)}
                    aria-label="Close"
                    className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="px-4 pb-4">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}

            {guestOpen && !isSignedIn && (
              /* ── Signed-out: desktop absolute popover ── */
              <motion.div
                key="auth-form-desktop"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="hidden md:block absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 pt-3">
                  <span />
                  <button
                    onClick={() => setGuestOpen(false)}
                    aria-label="Close"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <AuthForm onSuccess={() => setGuestOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile full-screen sign-in — portal escapes backdrop-filter stacking context */}
          {isMounted && createPortal(
            <AnimatePresence>
              {guestOpen && !isSignedIn && (
                <motion.div
                  key="auth-form-mobile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-[200] flex flex-col overflow-y-auto md:hidden bg-background"
                >
                  <button
                    onClick={() => setGuestOpen(false)}
                    aria-label="Close"
                    className="fixed top-4 right-4 z-[201] w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
                  >
                    <X className="w-4 h-4 text-foreground" />
                  </button>
                  <div className="flex-1 flex items-center justify-center p-6">
                    <div
                      className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl"
                      onMouseDown={e => e.stopPropagation()}
                      onTouchStart={e => e.stopPropagation()}
                    >
                      <AuthForm onSuccess={() => setGuestOpen(false)} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

          {/* Theme toggle — cycles light → dark → auto */}
          <button
            onClick={handleColorModeCycle}
            aria-label="Cycle theme: light, dark, auto"
            title={colorMode === 'light' ? 'Light mode' : colorMode === 'dark' ? 'Dark mode' : 'Auto (system)'}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {colorMode === 'dark' ? <Moon className="w-5 h-5" /> : colorMode === 'light' ? <Sun className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Settings */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>

      </div>
    </header>
  )
}
