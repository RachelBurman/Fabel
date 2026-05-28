'use client'

import { motion } from 'framer-motion'
import { ChefHat, Search, Heart, Settings, Leaf, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavScreen = 'ingredients' | 'pairings' | 'saved' | 'history'

interface BottomNavigationProps {
  currentScreen: NavScreen
  onNavigate: (screen: NavScreen) => void
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
  const navItems = [
    { id: 'ingredients' as const, label: 'Ingredients', icon: ChefHat },
    { id: 'pairings'    as const, label: 'Pairings',    icon: Search  },
    { id: 'history'     as const, label: 'History',     icon: Clock   },
    { id: 'saved'       as const, label: 'Saved',       icon: Heart   },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-pb">
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

interface HeaderProps {
  onSettingsClick?: () => void
}

export function Header({ onSettingsClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-primary" />
          </div>
          <span className="text-lg font-semibold text-foreground">Fable</span>
        </div>
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}
