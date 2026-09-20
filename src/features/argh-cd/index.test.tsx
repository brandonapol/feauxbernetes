import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { advanceTicks, renderArghCd } from './__fixtures__/renderArghCd'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Argh CD routing', () => {
  it('redirects the bare tab to Applications', () => {
    renderArghCd('#/argh-cd')
    advanceTicks()
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
  })

  it('redirects an unknown sub-route to Applications', () => {
    renderArghCd('#/argh-cd/nonsense')
    advanceTicks()
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
  })

  it('deep-links straight to the boxes view', () => {
    renderArghCd('#/argh-cd/boxes')
    advanceTicks()
    expect(screen.getByRole('heading', { name: 'Boxes' })).toBeInTheDocument()
  })

  it('deep-links straight to one app’s view', () => {
    renderArghCd('#/argh-cd/app/billing')
    advanceTicks()
    expect(screen.getByRole('heading', { name: 'billing' })).toBeInTheDocument()
  })

  it('deep-links straight to the database view', () => {
    renderArghCd('#/argh-cd/database')
    advanceTicks()
    expect(screen.getByRole('heading', { name: /database/ })).toBeInTheDocument()
  })
})
