import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { createGameConfig } from '../../content'
import { createGameStore, type StorageLike, type Timers } from '../../store'
import { App } from '../shell/App'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

const timers: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

function renderGrafauxna(hash = '#/grafauxna') {
  window.location.hash = hash
  const store = createGameStore({
    config: createGameConfig(),
    storage: noStorage,
    timers,
    search: '?fast=1',
  })
  act(() => {
    store.getState().pause()
    store.setState((s) => ({
      game: {
        ...s.game,
        ui: {
          ...s.game.ui,
          unlockedTabs: [...new Set([...s.game.ui.unlockedTabs, 'grafauxna' as const])],
          activeTab: 'grafauxna',
        },
      },
    }))
  })
  render(<App store={store} />)
  return store
}

describe('Grafauxna', () => {
  it('shows four golden-signal charts with a text summary and a table toggle', async () => {
    const user = userEvent.setup()
    renderGrafauxna('#/grafauxna')
    expect(screen.getByRole('heading', { name: 'Dashboards' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Latency (p95)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Errors' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Show as a table' })[0])
    expect(screen.getByRole('columnheader', { name: 'ms' })).toBeInTheDocument()
  })

  it('filters logs by service and search', async () => {
    const user = userEvent.setup()
    renderGrafauxna('#/grafauxna/logs')
    expect(screen.getByRole('heading', { name: 'Logs' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search logs')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'billing', pressed: false }))
    expect(screen.getByRole('button', { name: 'billing' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows an SLO with remaining error budget and the alert rules list', () => {
    renderGrafauxna('#/grafauxna/slos')
    expect(screen.getByRole('heading', { name: 'billing checkout' })).toBeInTheDocument()
    expect(screen.getByText(/Error budget remaining/)).toBeInTheDocument()

    window.location.hash = '#/grafauxna/alerts'
    renderGrafauxna('#/grafauxna/alerts')
    expect(screen.getByText('Page on any error')).toBeInTheDocument()
    expect(screen.getByText(/burning the budget/i)).toBeInTheDocument()
  })
})
