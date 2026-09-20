import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { createGameConfig } from '../../content'
import { createGameStore, GameStoreProvider, useDispatch } from '../../store'
import { OverlayHost } from './OverlayHost'

/** A trigger button plus the host, the way `Browser` really uses it. */
function Harness() {
  const dispatch = useDispatch()
  return (
    <>
      <button
        type="button"
        onClick={() => dispatch({ type: 'openOverlay', overlay: 'test-builder' })}
      >
        Open the order form
      </button>
      <OverlayHost />
    </>
  )
}

function renderHarness() {
  const store = createGameStore({ config: createGameConfig() })
  render(
    <GameStoreProvider store={store}>
      <Harness />
    </GameStoreProvider>
  )
  return store
}

describe('OverlayHost', () => {
  it('renders nothing when no overlay is open', () => {
    renderHarness()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as a labelled dialog, moves focus in, and closes on Escape, returning focus', async () => {
    const user = userEvent.setup()
    renderHarness()
    const trigger = screen.getByRole('button', { name: 'Open the order form' })
    trigger.focus()
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Test builder' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Test builder' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on the Close button and on a backdrop click', async () => {
    const user = userEvent.setup()
    renderHarness()
    await user.click(screen.getByRole('button', { name: 'Open the order form' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open the order form' }))
    const dialog = screen.getByRole('dialog')
    await user.click(dialog.parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('traps Tab within the overlay', async () => {
    const user = userEvent.setup()
    renderHarness()
    await user.click(screen.getByRole('button', { name: 'Open the order form' }))

    const gotIt = screen.getByRole('button', { name: 'Got it' })
    const close = screen.getByRole('button', { name: 'Close' })

    // The heading takes the initial focus; Tab from there reaches the dialog's own buttons and
    // wraps around rather than escaping to the trigger button behind it.
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab()
    expect(gotIt).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(gotIt).toHaveFocus()
  })

  it('shows different placeholder copy for a different overlay id', () => {
    const store = createGameStore({ config: createGameConfig() })
    store.getState().dispatch({ type: 'openOverlay', overlay: 'page' })
    render(
      <GameStoreProvider store={store}>
        <OverlayHost />
      </GameStoreProvider>
    )
    expect(screen.getByRole('dialog', { name: 'Incoming page' })).toBeInTheDocument()
    expect(screen.getByText(/pager interruption/)).toBeInTheDocument()
  })
})
