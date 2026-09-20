import { act, render } from '@testing-library/react'

import { createGameConfig } from '../../../content'
import { createGameStore, type StorageLike, type Timers } from '../../../store'
import { App } from '../../shell/App'

export const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

export const timers: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

/** Renders the app on a GitNub route with the tab unlocked (placeholder Ch 0 leaves it locked). */
export function renderGitNub(hash = '#/gitnub') {
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
          unlockedTabs: [...new Set([...s.game.ui.unlockedTabs, 'gitnub' as const])],
          activeTab: 'gitnub',
        },
      },
    }))
  })
  render(<App store={store} />)
  return store
}
