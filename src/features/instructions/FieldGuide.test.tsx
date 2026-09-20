import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { FieldGuide } from './FieldGuide'

describe('FieldGuide', () => {
  it('renders the printable week-one guide', () => {
    render(
      <MemoryRouter>
        <FieldGuide />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'SRE Field Guide v1' })).toBeInTheDocument()
    expect(screen.getByText(/GitNub is the source of truth/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Feauxbernetes/ })).toHaveAttribute('href', '/')
  })
})
