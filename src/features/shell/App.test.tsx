import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { createGameConfig } from '../../content'
import { createGameStore, type StorageLike } from '../../store'
import { App } from './App'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function renderApp(hash = '') {
  window.location.hash = hash
  const store = createGameStore({ config: createGameConfig(), storage: noStorage })
  render(<App store={store} />)
  return store
}

describe('App shell', () => {
  it('says so when a saved game couldn’t be loaded, until dismissed', async () => {
    const oldSave: StorageLike = { ...noStorage, getItem: () => '{"version":0}' }
    render(<App store={createGameStore({ config: createGameConfig(), storage: oldSave })} />)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('your saved progress couldn’t be loaded')
    await userEvent.click(within(notice).getByRole('button', { name: 'OK' }))
    expect(screen.queryByText(/saved progress couldn’t be loaded/)).not.toBeInTheDocument()
  })

  it('has labelled landmarks for all three columns', () => {
    renderApp()
    expect(screen.getByRole('complementary', { name: 'Instructions' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Browser' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ops Console' })).toBeInTheDocument()
  })

  it('includes the small-screen notice', () => {
    renderApp()
    expect(screen.getByRole('note')).toHaveTextContent(
      'Feauxbernetes works best on a laptop or desktop'
    )
  })

  it('renders the real Instructions panel and the Ops Console empty state', () => {
    renderApp()
    // #11 replaced the Instructions placeholder, and #13 replaced the Ops Console's. The
    // placeholder chapter (`src/content/chapters`) completes as soon as it's entered, so
    // Instructions shows the "Chapter complete" card rather than a step, and its one step has no
    // `wishOptions`, so the real Ops Console shows its empty state (`ops-console/WishPanel.tsx`).
    expect(
      screen.getByRole('complementary', { name: 'Instructions' }).querySelector('h1')
    ).toHaveTextContent('Placeholder')
    expect(screen.getByRole('region', { name: 'Chapter complete' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ops Console' })).toHaveTextContent(
      'Nothing to do here right now. Watch the feed.'
    )
  })
})
