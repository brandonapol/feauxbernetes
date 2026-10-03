import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  brokenBillingState,
  incidentConfig,
} from '../../engine/incident/__fixtures__/incidentConfig'
import type { IncidentCommand } from '../../engine/incident'
import {
  createGameStore,
  GameStoreProvider,
  TICK_INTERVAL_MS,
  type GameStore,
  type StorageLike,
} from '../../store'
import { ChannelView } from '../flack/ChannelView'
import { IncidentHud } from './IncidentHud'
import { Scorecard } from './Scorecard'
import { StatusComposer } from './StatusComposer'

const config = incidentConfig()

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function setup(ui: React.ReactNode) {
  const store = createGameStore({ config, storage: noStorage })
  store.setState({ game: brokenBillingState(config) })
  render(
    <GameStoreProvider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </GameStoreProvider>
  )
  return store
}

function command(store: GameStore, cmd: IncidentCommand) {
  act(() => store.getState().dispatch({ type: 'incident', command: cmd }))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('IncidentHud: chip', () => {
  it('shows nothing on an ordinary day', () => {
    setup(<IncidentHud />)
    expect(screen.queryByRole('status', { name: 'Open incident' })).toBeNull()
    expect(screen.queryByRole('button', { name: /pause/i })).toBeNull()
  })

  it('shows severity, service and a climbing impact count while the incident is open', () => {
    const store = setup(<IncidentHud />)
    command(store, { kind: 'declare', severity: 'SEV2', service: 'billing' })
    const chip = screen.getByRole('status', { name: 'Open incident' })
    expect(within(chip).getByText('SEV2 · billing')).toBeTruthy()
    expect(within(chip).getByRole('link').getAttribute('href')).toBe('/flack/inc-1-checkout')

    act(() => void vi.advanceTimersByTime(TICK_INTERVAL_MS * 300))
    const count = Number(
      within(chip)
        .getByText(/^\d[\d,]*$/)
        .textContent!.replace(/,/g, '')
    )
    expect(count).toBeGreaterThan(0)
    expect(within(chip).getByText(/failed coupon checkouts/)).toBeTruthy()
  })

  it('marks the count stopped after mitigation and disappears once resolved', () => {
    const store = setup(<IncidentHud />)
    command(store, { kind: 'declare', severity: 'SEV2', service: 'billing' })
    command(store, { kind: 'recovered' })
    expect(screen.getByText(/stopped/)).toBeTruthy()
    command(store, { kind: 'resolve' })
    expect(screen.queryByRole('status', { name: 'Open incident' })).toBeNull()
  })
})

describe('IncidentHud: pause', () => {
  it('pauses the store with a "Paused: take your time" overlay, and resumes from it', () => {
    const store = setup(<IncidentHud />)
    command(store, { kind: 'declare', severity: 'SEV2', service: 'billing' })

    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(store.getState().paused).toBe(true)
    const dialog = screen.getByRole('dialog', { name: 'Paused: take your time' })
    const clock = store.getState().game.clock.now
    const customers = store.getState().game.incident.current!.impact.customers

    act(() => void vi.advanceTimersByTime(60_000))
    expect(store.getState().game.clock.now).toBe(clock)
    expect(store.getState().game.incident.current!.impact.customers).toBe(customers)

    fireEvent.click(within(dialog).getByRole('button', { name: /resume/i }))
    expect(store.getState().paused).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows no overlay when the store is paused outside an incident', () => {
    const store = setup(<IncidentHud />)
    act(() => store.getState().pause())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('StatusComposer', () => {
  it('renders nothing without an open incident', () => {
    setup(<StatusComposer />)
    expect(screen.queryByRole('form', { name: 'Status update' })).toBeNull()
  })

  it('offers three pre-written updates for the next stage, explains the pick, and posts it', () => {
    const store = setup(<StatusComposer />)
    command(store, { kind: 'declare', severity: 'SEV2', service: 'billing' })

    const form = screen.getByRole('form', { name: 'Status update' })
    expect(
      within(form).getByRole('radio', { name: 'Investigating' }).getAttribute('aria-checked')
    ).toBe('true')
    const options = within(form).getAllByRole('radio', { name: /investigating update/ })
    expect(options).toHaveLength(3)

    const post = within(form).getByRole('button', { name: 'Post to status page' })
    expect((post as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(within(form).getByRole('radio', { name: 'investigating update b' }))
    expect(within(form).getByText('investigating note b')).toBeTruthy()
    fireEvent.click(post)

    const game = store.getState().game
    expect(game.statusPage.updates.at(-1)).toMatchObject({
      component: 'checkout',
      message: 'investigating update b',
    })
    expect(game.flack.messages.at(-1)).toMatchObject({ channel: 'inc-1-checkout', from: 'taylor' })
    // Moves on to the next stage, marking the posted one.
    expect(
      within(form).getByRole('radio', { name: 'Identified' }).getAttribute('aria-checked')
    ).toBe('true')
    expect(within(form).getByRole('radio', { name: /Investigating/ }).textContent).toContain('✓')
  })

  it('lets the learner pick any stage', () => {
    const store = setup(<StatusComposer />)
    command(store, { kind: 'declare', severity: 'SEV2', service: 'billing' })
    fireEvent.click(screen.getByRole('radio', { name: 'Monitoring' }))
    fireEvent.click(screen.getByRole('radio', { name: 'monitoring update a' }))
    fireEvent.click(screen.getByRole('button', { name: 'Post to status page' }))
    expect(store.getState().game.incident.current?.statusPosts).toEqual([
      { stage: 'monitoring', optionId: 'monitoring-a' },
    ])
  })
})

describe('Scorecard', () => {
  it('shows each number next to the typical range, with a note and no pass/fail', () => {
    const store = setup(null)
    command(store, { kind: 'page', service: 'billing', text: 'checkout' })
    act(() => void vi.advanceTimersByTime(TICK_INTERVAL_MS * 10))
    command(store, { kind: 'ack' })
    command(store, { kind: 'recovered' })
    command(store, { kind: 'resolve' })
    const incident = store.getState().game.incident.current!
    render(
      <GameStoreProvider store={store}>
        <Scorecard incident={incident} />
      </GameStoreProvider>
    )
    const table = screen.getByRole('table')
    const mtta = within(table).getByRole('row', { name: /Time to acknowledge/ })
    expect(within(mtta).getByText('1m–5m')).toBeTruthy()
    expect(within(mtta).getByText('Below typical')).toBeTruthy()
    expect(within(mtta).getByText('mtta below')).toBeTruthy()
    expect(within(table).getByRole('row', { name: /Customers affected/ })).toBeTruthy()
    expect(screen.queryByText(/pass|fail/i)).toBeNull()
  })
})

describe('Flack incident channel', () => {
  it('shows the impact counter and Pause in the header, and the composer below', () => {
    const store = setup(<ChannelView channelId="inc-1-checkout" />)
    command(store, { kind: 'declare', severity: 'SEV2', service: 'billing' })
    const channel = screen.getByRole('region', { name: '#inc-1-checkout' })
    const header = within(channel).getByRole('banner')
    expect(within(header).getByText(/failed coupon checkouts/)).toBeTruthy()
    expect(within(header).getByRole('button', { name: /pause/i })).toBeTruthy()
    expect(within(channel).getByRole('form', { name: 'Status update' })).toBeTruthy()

    command(store, { kind: 'resolve' })
    expect(within(channel).queryByRole('form', { name: 'Status update' })).toBeNull()
    expect(within(channel).getByRole('region', { name: 'Scorecard' })).toBeTruthy()
  })
})
