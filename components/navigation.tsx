'use client'

import { motion } from 'framer-motion'
import { ChefHat, BookOpen, Heart, Settings, Leaf, Clock, ShieldCheck, ArrowLeftRight, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useFable } from '@/lib/fable-context'

type NavScreen = 'ingredients' | 'recipe' | 'substitutes' | 'saved' | 'history'

interface BottomNavigationProps {
  currentScreen: NavScreen
  onNavigate: (screen: NavScreen) => void
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
  const navItems = [
    { id: 'ingredients'  as const, label: 'Kitchen',     icon: ChefHat        },
    { id: 'recipe'       as const, label: 'Recipe',      icon: BookOpen       },
    { id: 'substitutes'  as const, label: 'Substitutes', icon: ArrowLeftRight },
    { id: 'history'      as const, label: 'History',     icon: Clock          },
    { id: 'saved'        as const, label: 'Saved',       icon: Heart          },
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
  const { preferences, setDarkMode } = useFable()
  const { theme, setTheme } = useTheme()
  const safeFoodsActive = preferences.safeFoodsMode && preferences.safeIngredients.length > 0
  const isDark = theme === 'dark'

  const handleThemeToggle = () => {
    const newDark = !isDark
    setTheme(newDark ? 'dark' : 'light')
    setDarkMode(newDark)
  }

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-1">
          <button
            onClick={handleThemeToggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
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
