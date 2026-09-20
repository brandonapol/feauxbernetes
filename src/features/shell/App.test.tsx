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

  it('shows the Instructions and Ops Console placeholders', () => {
    renderApp()
    expect(
      screen.getByRole('complementary', { name: 'Instructions' }).querySelector('h2')
    ).toHaveTextContent('Instructions')
    expect(
      screen.getByRole('region', { name: 'Ops Console' }).querySelector('h2')
    ).toHaveTextContent('Ops Console')
  })
})
