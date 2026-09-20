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

function renderPager() {
  window.location.hash = '#/pagerdoody'
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
          unlockedTabs: [...new Set([...s.game.ui.unlockedTabs, 'pagerdoody' as const])],
          activeTab: 'pagerdoody',
        },
      },
    }))
  })
  render(<App store={store} />)
  return store
}

describe('PagerDoody', () => {
  it('shows the week’s on-call schedule with you on Friday', () => {
    renderPager()
    expect(screen.getByRole('heading', { name: 'On-call schedule' })).toBeInTheDocument()
    expect(screen.getByText('Friday')).toBeInTheDocument()
    expect(screen.getByText('No incidents. That’s a good day.')).toBeInTheDocument()
  })

  it('the page overlay acknowledges and closes, with no sound', async () => {
    const user = userEvent.setup()
    const store = renderPager()
    await user.click(screen.getByRole('button', { name: 'Preview a page' }))
    expect(screen.getByRole('dialog', { name: 'Incoming page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toHaveAttribute(
      'data-target',
      'page-ack'
    )
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(store.getState().game.ui.overlay).toBeUndefined()
  })
})
