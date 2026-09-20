import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { createGameStore, GameStoreProvider, type StorageLike } from '../../store'
import { SCALE_SEARCH, testConfig } from './__fixtures__/testConfig'
import { OpsConsole } from './index'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function renderConsole(options: Parameters<typeof testConfig>[0] = {}) {
  const store = createGameStore({ config: testConfig(options), storage: noStorage })
  render(
    <GameStoreProvider store={store}>
      <OpsConsole />
    </GameStoreProvider>
  )
  return store
}

describe('OpsConsole', () => {
  it('shows both headings and the empty state when the chapter offers no wishes', () => {
    renderConsole({ wishOptions: [] })
    expect(screen.getByText('What do you want?')).toBeInTheDocument()
    expect(screen.getByText('What’s happening')).toBeInTheDocument()
    expect(screen.getByText('Nothing to do here right now. Watch the feed.')).toBeInTheDocument()
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('renders a chapter-provided wish as a radio card', () => {
    renderConsole({ wishOptions: [SCALE_SEARCH] })
    expect(screen.getByRole('radio', { name: /search/i })).toBeInTheDocument()
  })

  it('hides the GitOps banner before Ch 4', () => {
    renderConsole({ gitOpsEnforced: false })
    expect(screen.queryByText(/Changes here are temporary/)).not.toBeInTheDocument()
  })

  it('shows the GitOps banner from Ch 4 on, linking to GitNub', async () => {
    const store = renderConsole({ gitOpsEnforced: true })
    expect(screen.getByText(/Changes here are temporary/)).toBeInTheDocument()

    const link = screen.getByRole('button', { name: /Propose them in GitNub/ })
    await userEvent.click(link)
    expect(store.getState().game.ui.activeTab).toBe('gitnub')
  })
})
