import { act, fireEvent, screen, within } from '@testing-library/react'
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

describe('AppView', () => {
  it('shows health, wants/has and a one-sentence summary naming the boxes it runs on', () => {
    renderArghCd('#/argh-cd/app/search')
    advanceTicks()

    expect(screen.getByRole('heading', { name: 'search' })).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('wants 3 · has 3')).toBeInTheDocument()
    expect(screen.getByText(/^search: 3 copies running on boxes/)).toBeInTheDocument()
  })

  it('groups copies by box, and redirects an unknown app back to Applications', () => {
    renderArghCd('#/argh-cd/app/search')
    advanceTicks()
    expect(screen.getByRole('heading', { level: 2, name: /Box A/ })).toBeInTheDocument()

    renderArghCd('#/argh-cd/app/not-a-real-app')
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
  })

  it('the database app has no app view of its own (it redirects to Applications)', () => {
    renderArghCd('#/argh-cd/app/database')
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
  })

  it('opens a copy drawer with its app, version, box, restarts and state', async () => {
    renderArghCd('#/argh-cd/app/search')
    settleCluster()
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: /^search copy/ })[0])
    const drawer = screen.getByRole('dialog')
    expect(within(drawer).getByText('search', { selector: 'dd' })).toBeInTheDocument()
    expect(within(drawer).getByText('1.4', { selector: 'dd' })).toBeInTheDocument()
    expect(within(drawer).getByText('0', { selector: 'dd' })).toBeInTheDocument() // restarts
    expect(within(drawer).getByText('Running')).toBeInTheDocument()
    expect(within(drawer).getByText(/^Box /, { selector: 'dd' })).toBeInTheDocument()
  })

  it('closes the drawer on Escape and returns focus to the copy that opened it', async () => {
    renderArghCd('#/argh-cd/app/search')
    settleCluster()
    const user = userEvent.setup()

    const chip = screen.getAllByRole('button', { name: /^search copy/ })[0]
    await user.click(chip)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chip).toHaveFocus()
  })

  it('has no "Unplug this copy" button until a chapter unlocks it, then unplugging drives wants/has through the cluster', () => {
    const store = renderArghCd('#/argh-cd/app/search')
    advanceTicks()
    const click = (element: Element) => act(() => void fireEvent.click(element))

    click(screen.getAllByRole('button', { name: /^search copy/ })[0])
    expect(screen.queryByRole('button', { name: 'Unplug this copy' })).not.toBeInTheDocument()
    click(screen.getByRole('button', { name: 'Close' }))

    act(() => {
      store.setState((s) => ({ game: { ...s.game, ui: { ...s.game.ui, canUnplugCopies: true } } }))
    })

    click(screen.getAllByRole('button', { name: /^search copy/ })[0])
    const unplug = screen.getByRole('button', { name: 'Unplug this copy' })
    expect(unplug).toHaveAttribute('data-target')
    expect(unplug.getAttribute('data-target')).toMatch(/^copy:/)
    click(unplug)

    // Driven purely by cluster state: wants 3 · has 2, then a replacement brings it back to 3.
    expect(screen.getByText('wants 3 · has 2')).toBeInTheDocument()
    advanceTicks()
    expect(screen.getByText('wants 3 · has 3')).toBeInTheDocument()
  })

  it('has no serious accessibility problems, with a copy drawer open', async () => {
    renderArghCd('#/argh-cd/app/search')
    settleCluster()
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /^search copy/ })[0])

    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical'
    )
    expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
