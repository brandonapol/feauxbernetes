import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildEvent as buildClusterEvent } from '../../engine/cluster'
import { buildEvent as buildGitOpsEvent } from '../../engine/gitops'
import { createGameStore, GameStoreProvider, type GameStore, type StorageLike } from '../../store'
import { testConfig } from './__fixtures__/testConfig'
import { EventFeed } from './EventFeed'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function renderFeed(): GameStore {
  const store = createGameStore({ config: testConfig(), storage: noStorage })
  render(
    <GameStoreProvider store={store}>
      <EventFeed />
    </GameStoreProvider>
  )
  return store
}

const clusterEvent = buildClusterEvent(0, 'SuccessfulCreate', { app: 'search', copyId: 'search-1' })
const gitopsEvent = buildGitOpsEvent(0, 'AutoSync', { app: 'web', version: '1.9', copies: 3 })
const ciNotice = { at: 0, raw: 'checks: e2e passed', english: 'Checks passed for web ✓' }

describe('EventFeed', () => {
  it('shows English first, and the empty state before anything has happened', () => {
    renderFeed()
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('lists entries from all three sources and can expand each to its raw text', async () => {
    const store = renderFeed()
    act(() => {
      store.setState((s) => ({
        game: {
          ...s.game,
          clusterEvents: [clusterEvent],
          gitopsEvents: [gitopsEvent],
          ciNotices: [ciNotice],
        },
      }))
    })

    const list = screen.getByRole('list')
    expect(within(list).getByText(clusterEvent.english)).toBeInTheDocument()
    expect(within(list).getByText(gitopsEvent.english)).toBeInTheDocument()
    expect(within(list).getByText(ciNotice.english)).toBeInTheDocument()

    const item = within(list)
      .getByText(clusterEvent.english)
      .closest('details') as HTMLDetailsElement
    expect(item.open).toBe(false)

    // A native <details>/<summary> toggle: reachable by keyboard (it's tabbable on its own,
    // no tabIndex needed) and, per the HTML spec, Enter/Space on a focused <summary> activates it
    // the same as a click — jsdom's <details> support only wires up the click itself, so we
    // exercise that here and rely on the platform for the keyboard-to-click part.
    const summary = within(list).getByText(clusterEvent.english)
    summary.focus()
    expect(summary).toHaveFocus()
    await userEvent.click(summary)
    expect(item.open).toBe(true)
    expect(within(item).getByText(clusterEvent.raw)).toBeInTheDocument()
  })

  it('filter chips narrow the feed to one source at a time', async () => {
    const store = renderFeed()
    act(() => {
      store.setState((s) => ({
        game: {
          ...s.game,
          clusterEvents: [clusterEvent],
          gitopsEvents: [gitopsEvent],
          ciNotices: [ciNotice],
        },
      }))
    })

    const list = () => within(screen.getByRole('list'))

    await userEvent.click(screen.getByRole('button', { name: 'Deploys' }))
    expect(list().getByText(gitopsEvent.english)).toBeInTheDocument()
    expect(list().queryByText(clusterEvent.english)).not.toBeInTheDocument()
    expect(list().queryByText(ciNotice.english)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Checks' }))
    expect(list().getByText(ciNotice.english)).toBeInTheDocument()
    expect(list().queryByText(gitopsEvent.english)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(list().getByText(clusterEvent.english)).toBeInTheDocument()
    expect(list().getByText(gitopsEvent.english)).toBeInTheDocument()
    expect(list().getByText(ciNotice.english)).toBeInTheDocument()
  })

  it('filter chips are reachable and operable by keyboard', async () => {
    renderFeed()
    const cluster = screen.getByRole('button', { name: 'Cluster' })
    cluster.focus()
    expect(cluster).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(cluster).toHaveAttribute('aria-pressed', 'true')
  })

  describe('the live region', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('throttles announcements, always landing on the latest line', async () => {
      const store = renderFeed()
      const liveRegion = () => document.body.querySelector('[aria-live="polite"]')!

      act(() => {
        store.setState((s) => ({ game: { ...s.game, clusterEvents: [clusterEvent] } }))
      })
      expect(liveRegion()).toHaveTextContent(clusterEvent.english)

      const second = buildClusterEvent(1, 'Killing', { app: 'search', copyId: 'search-1' })
      const third = buildClusterEvent(2, 'Stopped', { app: 'search', copyId: 'search-1' })

      // Two more events land in quick succession, inside the throttle window: the live region
      // should still show the first line...
      act(() => {
        store.setState((s) => ({ game: { ...s.game, clusterEvents: [clusterEvent, second] } }))
      })
      expect(liveRegion()).toHaveTextContent(clusterEvent.english)

      act(() => {
        store.setState((s) => ({
          game: { ...s.game, clusterEvents: [clusterEvent, second, third] },
        }))
      })
      expect(liveRegion()).toHaveTextContent(clusterEvent.english)

      // ...until the throttle window elapses, when it catches up to the *latest* line, skipping
      // the one in between rather than reading every event.
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(liveRegion()).toHaveTextContent(third.english)
      expect(liveRegion()).not.toHaveTextContent(second.english)
    })
  })
})
