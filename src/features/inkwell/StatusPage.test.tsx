import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { createGameConfig } from '../../content'
import type { Copy } from '../../engine/cluster'
import { createGameStore, GameStoreProvider, type GameStore, type StorageLike } from '../../store'
import { Inkwell } from './Inkwell'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function renderStatus(store?: GameStore) {
  const theStore = store ?? createGameStore({ config: createGameConfig(), storage: noStorage })
  render(
    <GameStoreProvider store={theStore}>
      <MemoryRouter initialEntries={['/inkwell/status']}>
        <Routes>
          <Route path="/inkwell/*" element={<Inkwell />} />
        </Routes>
      </MemoryRouter>
    </GameStoreProvider>
  )
  return theStore
}

function componentsList() {
  return screen.getByRole('list', { name: 'Components' })
}

function incidentFeed() {
  return screen.getByRole('list', { name: 'Incident updates' })
}

function rowFor(label: string) {
  return within(componentsList()).getByText(label).closest('li')!
}

/** Makes `app` fully Running at `copies`, so its component reads as operational by default. */
function runFully(store: GameStore, app: string, version: string, copies: number) {
  act(() =>
    store.setState((s) => ({
      game: {
        ...s.game,
        cluster: {
          ...s.game.cluster,
          wishes: { ...s.game.cluster.wishes, [app]: { app, version, copies } },
          copies: [
            ...s.game.cluster.copies.filter((copy) => copy.app !== app),
            ...Array.from({ length: copies }, (_, i): Copy => {
              const state: Copy['state'] = 'Running'
              return {
                id: `${app}-${i}`,
                app,
                version,
                boxId: 'box-a',
                state,
                startedAt: 0,
                restarts: 0,
              }
            }),
          ],
        },
      },
    }))
  )
}

describe('status.inkwell.example', () => {
  it('lists Website, Search and Checkout, in that order', () => {
    renderStatus()
    const items = within(componentsList()).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText('Website')).toBeInTheDocument()
    expect(within(items[1]).getByText('Search')).toBeInTheDocument()
    expect(within(items[2]).getByText('Checkout')).toBeInTheDocument()
  })

  it('shows every component operational, and no incidents, when the fleet is healthy', () => {
    const store = renderStatus()
    runFully(store, 'web', '1.8', 2)
    runFully(store, 'search', '1.4', 2)
    runFully(store, 'billing', '2.4.0', 2)
    expect(screen.getByText('All systems operational')).toBeInTheDocument()
    expect(within(componentsList()).getAllByText('Operational')).toHaveLength(3)
    expect(screen.getByText('No incidents reported.')).toBeInTheDocument()
  })

  it('renders an update posted by the incident engine (#31) via postStatusUpdate', () => {
    const store = renderStatus()
    act(() =>
      store.getState().dispatch({
        type: 'postStatusUpdate',
        component: 'checkout',
        state: 'outage',
        message: 'Checkout is down for customers using a coupon. We are investigating.',
      })
    )
    expect(
      within(incidentFeed()).getByText(
        'Checkout is down for customers using a coupon. We are investigating.'
      )
    ).toBeInTheDocument()
    // The checkout component's badge follows the most recent update about it.
    expect(within(rowFor('Checkout')).getByText('Major outage')).toBeInTheDocument()
    expect(screen.getByText('Some systems are down')).toBeInTheDocument()
  })

  it('shows the newest update first and reflects the latest state per component', () => {
    const store = renderStatus()
    act(() => {
      store.getState().dispatch({
        type: 'postStatusUpdate',
        component: 'checkout',
        state: 'outage',
        message: "We've identified the issue.",
      })
      store.getState().dispatch({
        type: 'postStatusUpdate',
        component: 'checkout',
        state: 'operational',
        message: 'This incident has been resolved.',
      })
    })
    const entries = within(incidentFeed()).getAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent('This incident has been resolved.')
    expect(entries[1]).toHaveTextContent("We've identified the issue.")
    expect(within(rowFor('Checkout')).getByText('Operational')).toBeInTheDocument()
  })

  it('links back to inkwell.example', async () => {
    const user = userEvent.setup()
    renderStatus()
    await user.click(screen.getByRole('link', { name: /inkwell\.example/i }))
    expect(screen.getByRole('heading', { name: /write without friction/i })).toBeInTheDocument()
  })
})
