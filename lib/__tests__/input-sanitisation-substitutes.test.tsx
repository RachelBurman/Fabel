/**
 * @jest-environment jsdom
 *
 * Component tests for the SubstitutesScreen character counter and over-limit
 * button state. Tests both "Paste full recipe" (8,000 char limit) and
 * "Ingredients only" (2,000 char limit) input modes.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubstitutesScreen } from '../../components/substitutes-screen'

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
    },
  }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderAndSwitchToRecipeMode() {
  render(<SubstitutesScreen onBack={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /from a recipe/i }))
}

function getTextarea() {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

function getParseButton() {
  return screen.getByRole('button', { name: /parse recipe/i })
}

function getCounter() {
  // The counter is a <p> element adjacent to the textarea whose text matches "N / N,NNN"
  return screen.getByText(/\d[\d,]* \/ \d[\d,]*/)
}

// ─── Full-recipe mode (8,000 char limit) ─────────────────────────────────────

describe('SubstitutesScreen — full-recipe character counter', () => {
  it('shows "0 / 8,000" initially', () => {
    renderAndSwitchToRecipeMode()
    expect(getCounter()).toHaveTextContent('0 / 8,000')
  })

  it('updates the counter as text is typed', () => {
    renderAndSwitchToRecipeMode()
    fireEvent.change(getTextarea(), { target: { value: 'hello world' } })
    expect(getCounter()).toHaveTextContent('11 / 8,000')
  })

  it('counter text is not red when under the limit', () => {
    renderAndSwitchToRecipeMode()
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(8000) } })
    expect(getCounter()).not.toHaveClass('text-destructive')
  })

  it('counter text turns red when text exceeds 8,000 characters', () => {
    renderAndSwitchToRecipeMode()
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(8001) } })
    expect(getCounter()).toHaveClass('text-destructive')
  })

  it('shows the correct count when over the limit', () => {
    renderAndSwitchToRecipeMode()
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(8001) } })
    expect(getCounter()).toHaveTextContent('8,001 / 8,000')
  })
})

// ─── Parse button disabled state ─────────────────────────────────────────────

describe('SubstitutesScreen — Parse button disabled state', () => {
  it('parse button is disabled when textarea is empty', () => {
    renderAndSwitchToRecipeMode()
    expect(getParseButton()).toBeDisabled()
  })

  it('parse button is enabled when text is within the limit', () => {
    renderAndSwitchToRecipeMode()
    fireEvent.change(getTextarea(), { target: { value: 'some recipe text' } })
    expect(getParseButton()).not.toBeDisabled()
  })

  it('parse button is enabled at exactly 8,000 characters', () => {
    renderAndSwitchToRecipeMode()
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(8000) } })
    expect(getParseButton()).not.toBeDisabled()
  })

  it('parse button is disabled when text exceeds 8,000 characters', () => {
    renderAndSwitchToRecipeMode()
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(8001) } })
    expect(getParseButton()).toBeDisabled()
  })
})

// ─── Ingredients-only mode (2,000 char limit) ─────────────────────────────────

describe('SubstitutesScreen — ingredients-only character counter', () => {
  function switchToIngredientsMode() {
    renderAndSwitchToRecipeMode()
    fireEvent.click(screen.getByRole('button', { name: /ingredients only/i }))
  }

  it('shows "0 / 2,000" initially in ingredients-only mode', () => {
    switchToIngredientsMode()
    expect(getCounter()).toHaveTextContent('0 / 2,000')
  })

  it('counter turns red when text exceeds 2,000 characters', () => {
    switchToIngredientsMode()
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(2001) } })
    expect(getCounter()).toHaveClass('text-destructive')
    expect(getCounter()).toHaveTextContent('2,001 / 2,000')
  })

  it('parse button is disabled when ingredients text exceeds 2,000 characters', () => {
    switchToIngredientsMode()
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(2001) } })
    expect(screen.getByRole('button', { name: /parse ingredients/i })).toBeDisabled()
  })

  it('parse button is enabled at exactly 2,000 characters', () => {
    switchToIngredientsMode()
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(2000) } })
    expect(screen.getByRole('button', { name: /parse ingredients/i })).not.toBeDisabled()
  })
})

// ─── E2E: counter and button are in sync ─────────────────────────────────────

describe('SubstitutesScreen — counter and button stay in sync', () => {
  it('disables button and shows red counter simultaneously when over limit', () => {
    renderAndSwitchToRecipeMode()
    fireEvent.change(getTextarea(), { target: { value: 'x'.repeat(8001) } })

    expect(getCounter()).toHaveClass('text-destructive')
    expect(getParseButton()).toBeDisabled()
  })

  it('re-enables button and clears red counter when text is trimmed back within limit', () => {
    renderAndSwitchToRecipeMode()
    // First go over
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(8001) } })
    expect(getParseButton()).toBeDisabled()

    // Then come back within limit
    fireEvent.change(getTextarea(), { target: { value: 'a'.repeat(100) } })
    expect(getCounter()).not.toHaveClass('text-destructive')
    expect(getParseButton()).not.toBeDisabled()
  })
})
