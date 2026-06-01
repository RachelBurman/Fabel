'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, BookOpen, Heart, Settings, Leaf, Clock, ShieldCheck, ArrowLeftRight, Moon, Sun, User, X, Compass } from 'lucide-react'
import { useTheme } from 'next-themes'
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
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Leaf className="w-4 h-4 text-primary" />
        </div>
        <span className="text-lg font-semibold text-foreground">Fable</span>
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
  const { preferences, setDarkMode } = useFable()
  const { theme, setTheme } = useTheme()
  const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
  const isDark = theme === 'dark'

  const [guestOpen, setGuestOpen] = useState(false)
  const rightGroupRef = useRef<HTMLDivElement>(null)

  const handleThemeToggle = () => {
    const newDark = !isDark
    setTheme(newDark ? 'dark' : 'light')
    setDarkMode(newDark)
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

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-16 px-6 md:justify-end">

        {/* Left: logo + Safe Foods badge — hidden on desktop (sidebar shows the logo) */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-semibold text-foreground">Fable</span>
          {safeFoodsActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#15803d' }}
            >
              <ShieldCheck className="w-3 h-3" />
              Safe Foods
            </motion.div>
          )}
        </div>

        {/* Right: Guest badge + dark mode + settings */}
        <div ref={rightGroupRef} className="relative flex items-center gap-1">

          {/* Guest badge */}
          <button
            onClick={() => setGuestOpen(v => !v)}
            aria-label="Guest mode — tap to learn more"
            aria-expanded={guestOpen}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              guestOpen
                ? 'bg-secondary/80 text-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            )}
          >
            <User className="w-3 h-3 shrink-0" />
            Guest
          </button>

          {/* Guest popover */}
          <AnimatePresence>
            {guestOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute top-full right-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        You&apos;re using Fable as a guest
                      </p>
                    </div>
                    <button
                      onClick={() => setGuestOpen(false)}
                      aria-label="Close"
                      className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                    Your allergens, kitchen and recipes are saved to this browser. Create an account to access your data across all your devices — coming soon.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dark mode toggle */}
          <button
            onClick={handleThemeToggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
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
