import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { advanceTicks, renderArghCd, settleCluster } from './__fixtures__/renderArghCd'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Applications', () => {
  it('shows one tile per app, each with health, wants/has and version', () => {
    renderArghCd('#/argh-cd/applications')
    advanceTicks()

    const web = screen.getByRole('link', { name: /^web/ })
    expect(within(web).getByText('Healthy')).toBeInTheDocument()
    expect(within(web).getByText('wants 3 · has 3')).toBeInTheDocument()
    expect(within(web).getByText(/GitNub asks for 1\.8 · running 1\.8/)).toBeInTheDocument()
    expect(within(web).getByText('Synced')).toBeInTheDocument()
  })

  it('gives the database tile a 🐉 badge and its own health and version, with no wants/has line', () => {
    renderArghCd('#/argh-cd/applications')
    advanceTicks()

    const database = screen.getByRole('link', { name: /database/ })
    expect(within(database).getByText('🐉', { exact: false })).toBeInTheDocument()
    expect(within(database).getByText('Healthy')).toBeInTheDocument()
    expect(within(database).getByText('version 14.6')).toBeInTheDocument()
    expect(within(database).queryByText(/wants/)).not.toBeInTheDocument()
  })

  it('has a one-sentence text summary', () => {
    renderArghCd('#/argh-cd/applications')
    advanceTicks()
    expect(screen.getByText('All 3 apps and the database are healthy.')).toBeInTheDocument()
  })

  it('opens the app view when a tile is clicked', async () => {
    renderArghCd('#/argh-cd/applications')
    settleCluster()
    const user = userEvent.setup()

    await user.click(screen.getByRole('link', { name: /^search/ }))
    expect(screen.getByRole('heading', { name: 'search' })).toBeInTheDocument()
  })

  it('opens the database view when the database tile is clicked', async () => {
    renderArghCd('#/argh-cd/applications')
    settleCluster()
    const user = userEvent.setup()

    await user.click(screen.getByRole('link', { name: /database/ }))
    expect(screen.getByRole('heading', { name: /database/ })).toBeInTheDocument()
    expect(screen.getByText("Why can't I unplug this?")).toBeInTheDocument()
  })

  it('has no serious accessibility problems', async () => {
    renderArghCd('#/argh-cd/applications')
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
