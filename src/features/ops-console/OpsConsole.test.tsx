import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OpsConsole } from './index'

describe('Ops Console placeholder', () => {
  it('names itself and the ticket that replaces it', () => {
    render(<OpsConsole />)
    expect(screen.getByRole('heading', { name: 'Ops Console' })).toBeInTheDocument()
    expect(screen.getByText(/#13/)).toBeInTheDocument()
  })
})
