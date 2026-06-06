/**
 * @jest-environment jsdom
 *
 * Component test for the kitchen ingredient search input's 100-character limit.
 * Renders IngredientsScreen with all necessary mocks and verifies the input
 * element carries the maxLength attribute that the browser uses to enforce the cap.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IngredientsScreen } from '../../components/ingredients-screen'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('framer-motion', () => {
  const React = require('react')
  return {
    motion: {
      div: ({ children, className, style, onClick }: React.HTMLAttributes<HTMLDivElement>) =>
        React.createElement('div', { className, style, onClick }, children),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  }
})

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (children: React.ReactNode) => children,
}))

jest.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: null }),
}))

jest.mock('@/lib/fable-context', () => ({
  useFable: () => ({
    preferences: {
      ingredients: [],
      allergens: [],
      customAllergens: [],
      safeIngredients: [],
      safeFoodsMode: false,
      lactoseIntolerant: false,
      lactoseMode: 'exclude',
      kitchenEquipment: [],
      activePresets: [],
      showMacros: false,
      darkMode: false,
      discoverSettings: {},
      visibleTabs: [],
    },
    addIngredient: jest.fn(),
    removeIngredient: jest.fn(),
    setIngredients: jest.fn(),
    effectiveAllergens: [],
    effectiveCustomAllergens: [],
    toggleKitchenEquipment: jest.fn(),
  }),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

jest.mock('@/components/vision-review-screen', () => ({
  VisionReviewScreen: () => null,
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IngredientsScreen — ingredient search maxLength', () => {
  const defaultProps = {
    onShowPairings: jest.fn(),
    onGenerateRecipe: jest.fn(),
    onFindSubstitutes: jest.fn(),
  }

  it('renders the search input with maxLength of 100', () => {
    render(<IngredientsScreen {...defaultProps} />)
    const input = screen.getByPlaceholderText('Search 1,790 ingredients…') as HTMLInputElement
    expect(input.maxLength).toBe(100)
  })

  it('has the maxLength attribute set to "100" in the DOM', () => {
    render(<IngredientsScreen {...defaultProps} />)
    const input = screen.getByPlaceholderText('Search 1,790 ingredients…')
    expect(input).toHaveAttribute('maxLength', '100')
  })
})
