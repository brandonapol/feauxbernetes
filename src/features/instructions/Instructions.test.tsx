import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Instructions } from './index'

describe('Instructions placeholder', () => {
  it('names itself and the ticket that replaces it', () => {
    render(<Instructions />)
    expect(screen.getByRole('heading', { name: 'Instructions' })).toBeInTheDocument()
    expect(screen.getByText(/#11/)).toBeInTheDocument()
  })
})
