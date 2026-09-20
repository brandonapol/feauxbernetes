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

function renderPricing() {
  const store = createGameStore({ config: createGameConfig(), storage: noStorage })
  render(
    <GameStoreProvider store={store}>
      <MemoryRouter initialEntries={['/inkwell/pricing']}>
        <Routes>
          <Route path="/inkwell/*" element={<Inkwell />} />
        </Routes>
      </MemoryRouter>
    </GameStoreProvider>
  )
  return store
}

function setBillingVersion(store: GameStore, version: string) {
  act(() => store.getState().dispatch({ type: 'chooseWish', app: 'billing', version, copies: 2 }))
}

describe('inkwell.example/pricing checkout — billing@2.4.1 (#17, component test over version)', () => {
  it('shows the pre-filled test card and the suggested coupon', () => {
    renderPricing()
    expect(screen.getByLabelText('Card number')).toHaveValue('4242 4242 4242 4242')
    expect(screen.getByLabelText('Expiry')).toHaveValue('12/34')
    expect(screen.getByLabelText('CVC')).toHaveValue('123')
    expect(screen.getByRole('button', { name: /try save10/i })).toBeInTheDocument()
  })

  it('checks out fine with no coupon, on the buggy version too', async () => {
    const store = renderPricing()
    setBillingVersion(store, '2.4.1')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^pay/i }))
    expect(await screen.findByRole('heading', { name: 'Thanks!' })).toBeInTheDocument()
  })

  it('SAVE10 succeeds on 2.4.0: total drops to $9.00 and payment goes through', async () => {
    const store = renderPricing()
    setBillingVersion(store, '2.4.0')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /try save10/i }))
    expect(screen.getByText('$9.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^pay \$9\.00$/i }))
    expect(await screen.findByRole('heading', { name: 'Thanks!' })).toBeInTheDocument()
  })

  it('SAVE10 fails on 2.4.1: the double discount shows -$1.00 and payment errors out', async () => {
    const store = renderPricing()
    setBillingVersion(store, '2.4.1')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /try save10/i }))
    expect(screen.getByText('-$1.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^pay -\$1\.00$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.'
    )
    expect(screen.queryByRole('heading', { name: 'Thanks!' })).not.toBeInTheDocument()
  })

  it('SAVE10 succeeds again on 2.4.2, once the fix ships', async () => {
    const store = renderPricing()
    setBillingVersion(store, '2.4.2')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /try save10/i }))
    expect(screen.getByText('$9.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^pay \$9\.00$/i }))
    expect(await screen.findByRole('heading', { name: 'Thanks!' })).toBeInTheDocument()
  })

  it('rejects a coupon code that is not SAVE10, without changing the total', async () => {
    renderPricing()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Coupon code'), 'HALFOFF')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByText("That code isn't valid.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay $19.00' })).toBeInTheDocument()
  })
})
