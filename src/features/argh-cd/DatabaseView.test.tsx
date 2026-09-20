import { screen } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { advanceTicks, renderArghCd, settleCluster } from './__fixtures__/renderArghCd'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DatabaseView', () => {
  it('shows health, version, a one-sentence summary and no "unplug" button anywhere', () => {
    renderArghCd('#/argh-cd/database')
    advanceTicks()

    expect(screen.getByRole('heading', { name: /database/ })).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('version 14.6')).toBeInTheDocument()
    expect(screen.getByText('The database is healthy, running version 14.6.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unplug/i })).not.toBeInTheDocument()
  })

  it('explains why it can’t be unplugged, in plain English', () => {
    renderArghCd('#/argh-cd/database')
    advanceTicks()
    expect(screen.getByText("Why can't I unplug this?")).toBeInTheDocument()
    expect(screen.getAllByText(/operator/).length).toBeGreaterThan(0)
  })

  it('has a slot for the upgrade stages, empty until one is running', () => {
    renderArghCd('#/argh-cd/database')
    advanceTicks()
    expect(screen.getByText(/No upgrade running right now/)).toBeInTheDocument()
  })

  it('has no serious accessibility problems', async () => {
    renderArghCd('#/argh-cd/database')
    settleCluster()
    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical'
    )
    expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
