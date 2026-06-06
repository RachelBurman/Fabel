/**
 * @jest-environment jsdom
 *
 * Component tests for AuthForm input length validation.
 * Verifies that submission is blocked and an inline error is shown when any
 * field exceeds its RFC/bcrypt-derived limit, and that valid inputs pass through.
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AuthForm } from '../../components/auth-form'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSignIn = jest.fn()
const mockSignUp = jest.fn()

jest.mock('@/lib/auth-client', () => ({
  signIn: { email: (...args: unknown[]) => mockSignIn(...args) },
  signUp: { email: (...args: unknown[]) => mockSignUp(...args) },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function switchToSignup() {
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
}

function fillSignup(name: string, email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: name } })
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } })
}

function fillSignin(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSignIn.mockResolvedValue({ error: null })
  mockSignUp.mockResolvedValue({ error: null })
})

// ─── Name field (signup only) ─────────────────────────────────────────────────

describe('AuthForm — name field (signup)', () => {
  it('blocks submission and shows error when name exceeds 50 characters', () => {
    render(<AuthForm />)
    switchToSignup()
    fillSignup('a'.repeat(51), 'test@example.com', 'password123')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText(/50 characters/i)).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('allows submission when name is exactly 50 characters', async () => {
    render(<AuthForm />)
    switchToSignup()
    fillSignup('a'.repeat(50), 'test@example.com', 'password123')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    })

    expect(screen.queryByText(/50 characters/i)).not.toBeInTheDocument()
    expect(mockSignUp).toHaveBeenCalledTimes(1)
  })

  it('does not validate name length in signin mode', async () => {
    render(<AuthForm />)
    fillSignin('test@example.com', 'password123')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    })

    expect(screen.queryByText(/50 characters/i)).not.toBeInTheDocument()
    expect(mockSignIn).toHaveBeenCalledTimes(1)
  })
})

// ─── Email field ──────────────────────────────────────────────────────────────

describe('AuthForm — email field', () => {
  it('blocks signin submission and shows error when email exceeds 254 characters', () => {
    render(<AuthForm />)
    fillSignin('a'.repeat(250) + '@b.com', 'password123') // 256 chars
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText(/254 characters/i)).toBeInTheDocument()
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('blocks signup submission and shows error when email exceeds 254 characters', () => {
    render(<AuthForm />)
    switchToSignup()
    fillSignup('Alice', 'a'.repeat(250) + '@b.com', 'password123')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText(/254 characters/i)).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('allows submission when email is exactly 254 characters', async () => {
    render(<AuthForm />)
    // local(248) + @b.com(6) = 254 chars exactly
    const email254 = 'a'.repeat(248) + '@b.com'
    fillSignin(email254, 'password123')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    })

    expect(screen.queryByText(/254 characters/i)).not.toBeInTheDocument()
    expect(mockSignIn).toHaveBeenCalledTimes(1)
  })
})

// ─── Password field ───────────────────────────────────────────────────────────

describe('AuthForm — password field', () => {
  it('blocks signin submission and shows error when password exceeds 72 characters', () => {
    render(<AuthForm />)
    fillSignin('test@example.com', 'a'.repeat(73))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText(/72 characters/i)).toBeInTheDocument()
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('blocks signup submission and shows error when password exceeds 72 characters', () => {
    render(<AuthForm />)
    switchToSignup()
    fillSignup('Alice', 'test@example.com', 'a'.repeat(73))
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText(/72 characters/i)).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('allows submission when password is exactly 72 characters', async () => {
    render(<AuthForm />)
    fillSignin('test@example.com', 'a'.repeat(72))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    })

    expect(screen.queryByText(/72 characters/i)).not.toBeInTheDocument()
    expect(mockSignIn).toHaveBeenCalledTimes(1)
  })
})

// ─── Name validated before email/password ────────────────────────────────────

describe('AuthForm — validation order', () => {
  it('reports name error before email error in signup mode', () => {
    render(<AuthForm />)
    switchToSignup()
    // Both name and email are over limit
    fillSignup('a'.repeat(51), 'a'.repeat(260), 'password123')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText(/50 characters/i)).toBeInTheDocument()
    expect(screen.queryByText(/254 characters/i)).not.toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })
})
