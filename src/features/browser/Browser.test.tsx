import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Tab } from '../../engine/events'
import { createGameConfig } from '../../content'
import { createGameStore, type StorageLike } from '../../store'
import { App } from '../shell/App'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

/** Renders the whole app (deep-linking and redirects only make sense with the router in place),
 * optionally pinning `unlockedTabs` before the first render so a test isn't at the mercy of
 * whatever the placeholder chapter (#18 will replace it) happens to unlock by default. */
function renderApp(hash = '', tabs?: Tab[]) {
  window.location.hash = hash
  const store = createGameStore({ config: createGameConfig(), storage: noStorage })
  if (tabs) {
    store.setState((s) => ({ game: { ...s.game, ui: { ...s.game.ui, unlockedTabs: tabs } } }))
  }
  render(<App store={store} />)
  return store
}

beforeEach(() => {
  window.location.hash = ''
})

afterEach(() => {
  window.location.hash = ''
})

describe('Browser', () => {
  it('opens on the Flack tab and puts it in the URL', () => {
    renderApp('', ['flack'])
    expect(screen.getByRole('tab', { name: /Flack/ })).toHaveAttribute('aria-selected', 'true')
    expect(window.location.hash).toBe('#/flack')
  })

  it('a deep link to an unlocked tab opens it', async () => {
    const store = renderApp('#/argh-cd', ['flack', 'arghcd'])
    expect(await screen.findByRole('tab', { name: 'Argh CD' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(store.getState().game.ui.activeTab).toBe('arghcd')
    expect(window.location.hash).toBe('#/argh-cd')
  })

  it('a locked tab explains itself, cannot be opened by click, and stays put', async () => {
    const user = userEvent.setup()
    const store = renderApp('', ['flack'])
    const gitnub = screen.getByRole('tab', { name: /GitNub/ })
    expect(gitnub).toHaveAttribute('aria-disabled', 'true')
    expect(gitnub).toHaveAttribute('title', "You'll unlock this later in the story")
    expect(gitnub).toHaveAccessibleName(/you.ll unlock this later in the story/)
    await user.click(gitnub)
    expect(store.getState().game.ui.activeTab).toBe('flack')
    expect(window.location.hash).toBe('#/flack')
  })

  it('a deep link to a locked tab redirects to the active tab and explains why', async () => {
    renderApp('#/gitnub', ['flack'])
    expect(await screen.findByRole('tab', { name: 'Flack', selected: true })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/flack')
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent("GitNub isn't open to you yet")
  })

  it('tabs follow the ARIA tabs pattern with arrow keys', async () => {
    const user = userEvent.setup()
    const store = renderApp('', ['flack', 'gitnub', 'arghcd'])
    const tablist = screen.getByRole('tablist', { name: 'Apps' })
    const [flackTab, gitnubTab] = within(tablist).getAllByRole('tab')

    await user.click(flackTab)
    await user.keyboard('{ArrowRight}')
    expect(gitnubTab).toHaveFocus()
    expect(store.getState().game.ui.activeTab).toBe('gitnub')
    await user.keyboard('{End}')
    expect(store.getState().game.ui.activeTab).toBe('arghcd')
    await user.keyboard('{ArrowRight}')
    expect(store.getState().game.ui.activeTab).toBe('flack')
  })

  it('follows the story when it switches tabs', () => {
    const store = renderApp('', ['flack', 'gitnub', 'arghcd'])
    act(() => store.getState().dispatch({ type: 'openTab', tab: 'arghcd' }))
    expect(window.location.hash).toBe('#/argh-cd')
  })

  it('shows a read-only address bar for the active tab', () => {
    const store = renderApp('', ['flack', 'gitnub'])
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('flack.example/platform')
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveAttribute('readonly')
    act(() => store.getState().dispatch({ type: 'openTab', tab: 'gitnub' }))
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue(
      'gitnub.example/inkwell/deploy'
    )
  })

  it('back and forward move through the tabs actually visited', async () => {
    const user = userEvent.setup()
    const store = renderApp('', ['flack', 'gitnub', 'arghcd'])
    const back = screen.getByRole('button', { name: 'Back' })
    const forward = screen.getByRole('button', { name: 'Forward' })
    expect(back).toBeDisabled()
    expect(forward).toBeDisabled()

    await user.click(screen.getByRole('tab', { name: 'GitNub' }))
    await user.click(screen.getByRole('tab', { name: 'Argh CD' }))
    expect(store.getState().game.ui.activeTab).toBe('arghcd')
    expect(back).toBeEnabled()

    await user.click(back)
    expect(store.getState().game.ui.activeTab).toBe('gitnub')
    expect(forward).toBeEnabled()

    await user.click(back)
    expect(store.getState().game.ui.activeTab).toBe('flack')
    expect(back).toBeDisabled()

    await user.click(forward)
    await user.click(forward)
    expect(store.getState().game.ui.activeTab).toBe('arghcd')
    expect(forward).toBeDisabled()
  })

  it('shows an unread badge on Flack', () => {
    const store = renderApp('', ['flack'])
    act(() =>
      store.getState().dispatch({
        type: 'applyEffect',
        // Not the channel on screen (the default is "platform"), so it stays unread.
        effect: { type: 'flackMessage', channel: 'alerts', from: 'kai', text: 'Welcome!' },
      })
    )
    expect(screen.getByRole('tab', { name: /Flack/ })).toHaveAccessibleName('Flack, 1 unread')
  })
})
