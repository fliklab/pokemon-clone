import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./game/createGame', () => ({
  createGame: (_parent: string | HTMLElement, onReady: () => void) => {
    onReady()
    return { destroy: vi.fn() }
  },
}))

describe('App', () => {
  it('renders starter title', () => {
    render(<App />)
    expect(screen.getByText('Pokemon Clone Starter')).toBeInTheDocument()
  })
})
