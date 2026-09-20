import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { createGameConfig } from '../../content'
import { createGameStore, GameStoreProvider, type GameStore, type StorageLike } from '../../store'
import { Inkwell } from './Inkwell'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function renderInkwell(path = '/inkwell', store?: GameStore) {
  const theStore = store ?? createGameStore({ config: createGameConfig(), storage: noStorage })
  render(
    <GameStoreProvider store={theStore}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/inkwell/*" element={<Inkwell />} />
        </Routes>
      </MemoryRouter>
    </GameStoreProvider>
  )
  return theStore
}

/** Marks `app` as mid-rollout: one copy still on the old version, one already on the new one. */
function startRollout(store: GameStore, app: string, oldVersion: string, newVersion: string) {
  act(() =>
    store.setState((s) => ({
      game: {
        ...s.game,
        cluster: {
          ...s.game.cluster,
          copies: [
            {
              id: `${app}-old`,
              app,
              version: oldVersion,
              boxId: 'box-a',
              state: 'Running',
              startedAt: 0,
              restarts: 0,
            },
            {
              id: `${app}-new`,
              app,
              version: newVersion,
              boxId: 'box-a',
              state: 'Running',
              startedAt: 0,
              restarts: 0,
            },
          ],
        },
      },
    }))
  )
}

describe('Inkwell landing page', () => {
  it('welcomes a visitor and links to signup, pricing and status', () => {
    renderInkwell('/inkwell')
    expect(screen.getByRole('heading', { name: /write without friction/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start writing free/i })).toHaveAttribute(
      'href',
      '/inkwell/signup'
    )
    expect(screen.getAllByRole('link', { name: 'Pricing' })[0]).toHaveAttribute(
      'href',
      '/inkwell/pricing'
    )
    expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute('href', '/inkwell/status')
  })

  it("doesn't show a deploy badge when web is stable on one version", () => {
    renderInkwell('/inkwell')
    expect(screen.queryByText(/deploying an update/i)).not.toBeInTheDocument()
  })

  it('shows a reassuring deploy badge while web is mid-rollout, but stays up', () => {
    const store = createGameStore({ config: createGameConfig(), storage: noStorage })
    startRollout(store, 'web', '1.8', '1.9')
    renderInkwell('/inkwell', store)
    const badge = screen.getByText(/deploying an update/i)
    expect(badge).toHaveAttribute('title', expect.stringMatching(/won't notice/i))
    // The rest of the page rendered normally — the site stayed up through the "deploy".
    expect(screen.getByRole('heading', { name: /write without friction/i })).toBeInTheDocument()
  })

  it('navigates to signup and back home through the header nav', async () => {
    const user = userEvent.setup()
    renderInkwell('/inkwell')
    await user.click(screen.getByRole('link', { name: 'Sign up' }))
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /inkwell home/i }))
    expect(screen.getByRole('heading', { name: /write without friction/i })).toBeInTheDocument()
  })

  it('shows a not-found page for an unknown inkwell path', () => {
    renderInkwell('/inkwell/nonsense')
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })
})
