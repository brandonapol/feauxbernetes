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

function renderSignup() {
  const store = createGameStore({ config: createGameConfig(), storage: noStorage })
  render(
    <GameStoreProvider store={store}>
      <MemoryRouter initialEntries={['/inkwell/signup']}>
        <Routes>
          <Route path="/inkwell/*" element={<Inkwell />} />
        </Routes>
      </MemoryRouter>
    </GameStoreProvider>
  )
  return store
}

function setWebVersion(store: GameStore, version: string) {
  act(() => store.getState().dispatch({ type: 'chooseWish', app: 'web', version, copies: 2 }))
}

async function fillAndSubmit(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Name'), 'Sam Wilson')
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), 'hunter2hunter2')
  await user.click(screen.getByRole('button', { name: /create account/i }))
}

describe('inkwell.example/signup — web@1.9 (#17, component test over version)', () => {
  it('creates the account on 1.8 (before the bug shipped)', async () => {
    const store = renderSignup()
    setWebVersion(store, '1.8')
    await fillAndSubmit('sam.wilson@example.com')
    expect(await screen.findByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
  })

  it('rejects any dotted address on 1.9', async () => {
    const store = renderSignup()
    setWebVersion(store, '1.9')
    await fillAndSubmit('sam.wilson@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong \(500\)/i)
    expect(screen.queryByRole('heading', { name: 'Welcome!' })).not.toBeInTheDocument()
  })

  it('creates the account again on 2.0, once the fix ships', async () => {
    const store = renderSignup()
    setWebVersion(store, '2.0')
    await fillAndSubmit('sam.wilson@example.com')
    expect(await screen.findByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
  })

  it('lets a dot-free address through even on the buggy version', async () => {
    const store = renderSignup()
    setWebVersion(store, '1.9')
    await fillAndSubmit('sam@examplecom')
    expect(await screen.findByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
  })
})
