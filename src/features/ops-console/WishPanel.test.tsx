import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { createGameStore, GameStoreProvider, type StorageLike } from '../../store'
import { DELETE_EVERYTHING, SCALE_SEARCH, testConfig } from './__fixtures__/testConfig'
import { WishPanel } from './WishPanel'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function renderPanel(options: Parameters<typeof testConfig>[0] = {}) {
  const store = createGameStore({ config: testConfig(options), storage: noStorage })
  render(
    <GameStoreProvider store={store}>
      <WishPanel />
    </GameStoreProvider>
  )
  return store
}

describe('WishPanel', () => {
  it('shows the empty state when the chapter offers no wishes', () => {
    renderPanel({ wishOptions: [] })
    expect(screen.getByText('Nothing to do here right now. Watch the feed.')).toBeInTheDocument()
  })

  it('selecting a wish with the keyboard reveals its preview and "In real life" disclosure', async () => {
    renderPanel({ wishOptions: [SCALE_SEARCH] })

    const radio = screen.getByRole('radio', { name: /5.*copies.*search/i })
    expect(screen.queryByText('copies: 3 → 5')).not.toBeInTheDocument()

    // Keyboard only: Tab to the radio, then select it with Space.
    await userEvent.tab()
    expect(radio).toHaveFocus()
    await userEvent.keyboard(' ')

    expect(radio).toBeChecked()
    expect(screen.getByText('copies: 3 → 5')).toBeInTheDocument()
    expect(screen.getByText('In real life')).toBeInTheDocument()
    expect(screen.getByText('kubectl scale deployment search --replicas=5')).toBeInTheDocument()
  })

  it('"Make it so" dispatches the wish’s action and nothing else, reachable by keyboard alone', async () => {
    const store = renderPanel({ wishOptions: [SCALE_SEARCH] })

    await userEvent.tab() // focus the radio
    await userEvent.keyboard(' ') // select it, revealing "In real life" and the button
    await userEvent.tab() // focus the "In real life" disclosure
    await userEvent.tab() // focus "Make it so"
    const makeItSo = screen.getByRole('button', { name: 'Make it so' })
    expect(makeItSo).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(store.getState().game.cluster.wishes.search).toMatchObject({
      app: 'search',
      version: '1.4',
      copies: 5,
    })
    expect(screen.queryByText(/Kai:/)).not.toBeInTheDocument()
  })

  it('a deliberately wrong wish shows Kai’s response and dispatches nothing to the cluster', async () => {
    const store = renderPanel({ wishOptions: [DELETE_EVERYTHING] })
    const before = store.getState().game.cluster

    await userEvent.click(screen.getByRole('radio', { name: /delete everything/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Make it so' }))

    expect(store.getState().game.cluster).toBe(before) // untouched — nothing dispatched to it
    expect(screen.getByText(/Kai:/)).toBeInTheDocument()
    expect(screen.getByText(DELETE_EVERYTHING.veto!)).toBeInTheDocument()

    const messages = store.getState().game.flack.messages
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      from: 'kai',
      channel: 'platform',
      text: DELETE_EVERYTHING.veto,
    })
  })

  it('renders a YAML alternative, line by line, when a wish provides one', async () => {
    const withYaml = {
      ...SCALE_SEARCH,
      yaml: [{ code: 'spec:' }, { code: '  replicas: 5', note: 'How many copies to run.' }],
    }
    renderPanel({ wishOptions: [withYaml] })
    await userEvent.click(screen.getByRole('radio', { name: /search/i }))
    expect(screen.getByText('Or, as YAML:')).toBeInTheDocument()
    expect(screen.getByText('spec:')).toBeInTheDocument()
    expect(screen.getByText('replicas: 5')).toBeInTheDocument()
    expect(screen.getByText('How many copies to run.')).toBeInTheDocument()
  })
})
