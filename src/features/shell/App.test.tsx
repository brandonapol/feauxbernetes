import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App shell', () => {
  it('renders the placeholder', () => {
    render(<App />)
    expect(screen.getByText('Feauxbernetes')).toBeInTheDocument()
  })
})
