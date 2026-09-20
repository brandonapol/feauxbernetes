import { act, render } from '@testing-library/react'
import { vi } from 'vitest'

import { createGameConfig } from '../../../content'
import { createGameStore, TICK_INTERVAL_MS, type StorageLike, type Timers } from '../../../store'
import { App } from '../../shell/App'

export const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

/** Real `setTimeout`/`setInterval`, so `vi.useFakeTimers()` (which patches those globals) can
 * drive them deterministically — the same pattern `store/gameStore.test.ts` uses. */
export const timers: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

/**
 * Renders the whole app at an Argh CD hash route. Uses `?fast=1` so a handful of fake-clock ticks
 * (see `advanceTicks`) are enough to converge the cluster to its starting wishes. Callers must
 * bracket their tests with `vi.useFakeTimers()` / `vi.useRealTimers()`.
 */
export function renderArghCd(hash: string) {
  window.location.hash = hash
  const store = createGameStore({
    config: createGameConfig(),
    storage: noStorage,
    timers,
    search: '?fast=1',
  })
  render(<App store={store} />)
  return store
}

/** Advances the fake clock by `count` real store ticks, inside `act` so React sees every update. */
export function advanceTicks(count = 6) {
  act(() => {
    vi.advanceTimersByTime(TICK_INTERVAL_MS * count)
  })
}

/**
 * Advances enough ticks for the starting wishes to fully converge (copies scheduled, started, and
 * running), then switches back to real timers. `axe.run` and `userEvent` both schedule their own
 * timers internally, which never resolve under a fake clock that nothing is advancing any more —
 * this is the point every test that clicks something or runs axe should reach for first.
 */
export function settleCluster() {
  advanceTicks()
  vi.useRealTimers()
}
