import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createGameConfig } from '../../content'
import type { GameConfig } from '../../engine/story/types'
import { toyConfig } from '../../engine/story/__fixtures__/toyChapter'
import { createGameStore, GameStoreProvider, type GameStore, type StorageLike } from '../../store'
import { App } from '../shell/App'
import { Flack } from './Flack'
import { FlackNotifications } from './FlackNotifications'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

const timers = {
  setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (cb: () => void, ms: number) => setInterval(cb, ms),
  clearInterval: (handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>),
}

/**
 * `toyConfig` plus everything this suite needs beyond the bare engine test fixture: a mentor DM
 * (Ask Kai), a bot character, and Ask Kai's one FAQ entry. Kept local to this file rather than
 * added to the shared fixture, since no other engine test needs any of it.
 */
function flackTestConfig(): GameConfig {
  const base = toyConfig()
  return {
    ...base,
    channels: [
      ...base.channels,
      { id: 'dm-kai', name: 'Kai Nakamura', kind: 'dm', characterId: 'kai' },
    ],
    characters: {
      ...base.characters,
      kai: {
        id: 'kai',
        name: 'Kai Nakamura',
        initials: 'KN',
        role: 'Senior SRE',
        color: '#9c36b5',
      },
      arghcd: {
        id: 'arghcd',
        name: 'Argh CD',
        initials: 'CD',
        role: 'Deploy bot',
        color: '#495057',
        isBot: true,
      },
    },
    mentor: {
      characterId: 'kai',
      channel: 'dm-kai',
      entries: {
        'what-is-git': {
          question: 'What is Git?',
          answer: 'A time machine for files.',
          docs: { label: 'Git docs', href: 'https://git-scm.com/doc' },
        },
      },
    },
    mentorGeneralQuestions: ['what-is-git'],
  }
}

function setup(path = '/flack', config: GameConfig = flackTestConfig()) {
  const store = createGameStore({ config, storage: noStorage, timers })
  render(
    <GameStoreProvider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <FlackNotifications />
        <Routes>
          <Route path="/flack/:channel?" element={<Flack />} />
          <Route path="/grafauxna/*" element={<p>Grafauxna</p>} />
        </Routes>
      </MemoryRouter>
    </GameStoreProvider>
  )
  return { store }
}

/** Fake timers and userEvent don't mix well here, so clicks go through fireEvent. */
function click(element: HTMLElement) {
  act(() => {
    fireEvent.click(element)
  })
}

function say(store: GameStore, channel: string, text: string, from = 'jordan') {
  act(() =>
    store
      .getState()
      .dispatch({ type: 'applyEffect', effect: { type: 'flackMessage', channel, from, text } })
  )
}

/** Plays the toy chapter to the point where Sam's delayed, quick-repliable message is scheduled. */
function triggerDelayedMessage(store: GameStore) {
  act(() => {
    store.getState().dispatch({ type: 'clickTarget', targetId: 'start' })
    store.getState().dispatch({ type: 'setPlayerName', name: 'Ada Lovelace' })
    store.getState().dispatch({ type: 'skipStep' })
    store.getState().dispatch({ type: 'chooseOption', stepId: 'wish', optionId: 'three' })
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  window.location.hash = ''
})

afterEach(() => {
  vi.useRealTimers()
  window.location.hash = ''
})

describe('Flack', () => {
  it('shows the workspace, channels and DMs, and opens the default channel', () => {
    setup()
    const sidebar = screen.getByRole('navigation', { name: 'Channels' })
    expect(sidebar).toHaveTextContent('Inkwell')
    expect(within(sidebar).getByRole('button', { name: /team/ })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(within(sidebar).getByRole('button', { name: /Kai Nakamura/ })).toBeInTheDocument()
    expect(screen.getByRole('log')).toHaveTextContent('Hi! Click Start.')
  })

  it('shows messages for the channel you are in, with author and time, and hides others', () => {
    const { store } = setup()
    say(store, 'dm-kai', 'Ask me anything', 'kai')
    expect(screen.getByRole('log')).not.toHaveTextContent('Ask me anything')
    const sidebar = screen.getByRole('navigation', { name: 'Channels' })
    click(within(sidebar).getByRole('button', { name: /Kai Nakamura/ }))
    const log = screen.getByRole('log')
    expect(within(log).getByText('Kai Nakamura')).toBeInTheDocument()
    expect(log).toHaveTextContent(/\d:\d\d (AM|PM)/)
  })

  it('switching channel in the sidebar changes the view, updates the URL and marks it read', () => {
    const { store } = setup()
    say(store, 'dm-kai', 'Ask me anything', 'kai')
    const sidebar = screen.getByRole('navigation', { name: 'Channels' })
    expect(
      within(sidebar).getByRole('button', { name: /Kai Nakamura, 1 unread/ })
    ).toBeInTheDocument()

    click(within(sidebar).getByRole('button', { name: /Kai Nakamura/ }))
    expect(screen.getByRole('log')).toHaveTextContent('Ask me anything')
    expect(store.getState().game.flack.activeChannel).toBe('dm-kai')
    expect(screen.queryByText(/, 1 unread/)).not.toBeInTheDocument()
  })

  it('renders `code` and **bold** without raw HTML, and a deep link to another tab', () => {
    const { store } = setup()
    say(
      store,
      'team',
      'Run `git status` to **check**. <b>nope</b> [open dashboard](#/grafauxna/d/billing)'
    )
    const log = screen.getByRole('log')
    expect(within(log).getByText('git status').tagName).toBe('CODE')
    expect(within(log).getByText('check').tagName).toBe('STRONG')
    expect(log.innerHTML).not.toContain('<b>')
    expect(within(log).getByRole('link', { name: 'open dashboard' })).toHaveAttribute(
      'href',
      '#/grafauxna/d/billing'
    )
  })

  it('shows a typing indicator while a message is on its way, then the message itself', () => {
    const { store } = setup()
    triggerDelayedMessage(store)
    expect(screen.queryByText(/is typing/)).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.getByText(/Sam Rivera is typing…/)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1500))
    expect(screen.queryByText(/is typing/)).not.toBeInTheDocument()
    expect(screen.getByRole('log')).toHaveTextContent('Nice, Ada Lovelace!')
  })

  it('quick replies post your message once and then disappear', () => {
    const { store } = setup()
    triggerDelayedMessage(store)
    act(() => vi.advanceTimersByTime(3000))
    const reply = screen.getByRole('button', { name: '👋' })
    click(reply)
    expect(screen.queryByRole('button', { name: '👋' })).not.toBeInTheDocument()
    const log = screen.getByRole('log')
    expect(within(log).getByText('Sam Rivera')).toBeInTheDocument()
    expect(store.getState().game.flack.messages.filter((m) => m.from === 'player')).toHaveLength(1)
  })

  it('has a disabled composer that explains itself', () => {
    setup()
    const composer = screen.getByRole('textbox', { name: /Message box/ })
    expect(composer).toBeDisabled()
    expect(composer).toHaveAttribute('placeholder', 'Use the reply buttons for now')
  })

  it('pops a notification for a message in another channel, and opens it when clicked', () => {
    const { store } = setup()
    say(store, 'dm-kai', 'Psst, over here', 'kai')
    const toast = screen.getByRole('button', { name: /Psst, over here/ })
    expect(toast).toHaveTextContent('Kai Nakamura')
    click(toast)
    expect(store.getState().game.flack.activeChannel).toBe('dm-kai')
    expect(screen.queryByRole('button', { name: /Psst, over here/ })).not.toBeInTheDocument()
  })

  it('does not notify about the channel you are already reading', () => {
    const { store } = setup()
    say(store, 'team', 'Right here')
    expect(screen.queryByRole('button', { name: /Right here/ })).not.toBeInTheDocument()
  })
})

describe('bot messages', () => {
  it('shows a BOT badge and a structured card, with a link into another tab', () => {
    const { store } = setup()
    act(() =>
      store.getState().dispatch({
        type: 'applyEffect',
        effect: {
          type: 'flackMessage',
          channel: 'team',
          from: 'arghcd',
          text: 'Synced billing.',
          card: {
            title: 'billing synced to 2.4.1',
            fields: [
              { label: 'App', value: 'billing' },
              { label: 'Version', value: '2.4.1' },
            ],
            href: '#/argh-cd/apps/billing',
            linkLabel: 'Open Argh CD',
          },
        },
      })
    )
    const log = screen.getByRole('log')
    expect(within(log).getByText('BOT')).toBeInTheDocument()
    expect(within(log).getByText('billing synced to 2.4.1')).toBeInTheDocument()
    expect(within(log).getByText('App')).toBeInTheDocument()
    expect(within(log).getByText('billing')).toBeInTheDocument()
    expect(within(log).getByRole('link', { name: 'Open Argh CD' })).toHaveAttribute(
      'href',
      '#/argh-cd/apps/billing'
    )
  })

  it('a gitOpsNotice effect shows up in #deploys as an Argh CD bot message', () => {
    const config = flackTestConfig()
    config.channels.push({ id: 'deploys', name: 'deploys', kind: 'channel' })
    const { store } = setup('/flack/deploys', config)
    act(() =>
      store.getState().dispatch({
        type: 'applyEffect',
        effect: {
          type: 'gitOpsNotice',
          notice: {
            at: 0,
            channel: 'deploys',
            text: 'Argh CD synced billing to 2.4.1 ✅',
            appId: 'billing',
          },
        },
      })
    )
    const log = screen.getByRole('log')
    expect(within(log).getByText('Argh CD')).toBeInTheDocument()
    expect(log).toHaveTextContent('Argh CD synced billing to 2.4.1 ✅')
  })
})

describe('dynamic incident channels (#31 plumbing)', () => {
  it('a createChannel effect adds it to the sidebar, and openChannel focuses it', () => {
    const { store } = setup()
    act(() => {
      store.getState().dispatch({
        type: 'applyEffect',
        effect: {
          type: 'createChannel',
          channel: { id: 'inc-1-billing-outage', name: 'inc-1-billing-outage', kind: 'channel' },
        },
      })
      store.getState().dispatch({
        type: 'applyEffect',
        effect: { type: 'openChannel', channel: 'inc-1-billing-outage' },
      })
    })
    const sidebar = screen.getByRole('navigation', { name: 'Channels' })
    expect(within(sidebar).getByRole('button', { name: /inc-1-billing-outage/ })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(store.getState().game.flack.activeChannel).toBe('inc-1-billing-outage')
  })
})

describe('Ask Kai', () => {
  it('offers the general questions in the DM, and answers when asked', () => {
    const { store } = setup('/flack/dm-kai')
    const panel = screen.getByRole('list', { name: 'Questions you can ask Kai' })
    const question = within(panel).getByRole('button', { name: 'What is Git?' })
    click(question)
    const log = screen.getByRole('log')
    expect(log).toHaveTextContent('What is Git?')
    expect(log).toHaveTextContent('A time machine for files.')
    expect(within(log).getByRole('link', { name: 'Git docs' })).toHaveAttribute(
      'href',
      'https://git-scm.com/doc'
    )
    expect(
      store
        .getState()
        .game.flack.messages.slice(-2)
        .map((m) => m.from)
    ).toEqual(['player', 'kai'])
  })

  it('is only in the mentor DM', () => {
    setup('/flack/team')
    expect(
      screen.queryByRole('list', { name: 'Questions you can ask Kai' })
    ).not.toBeInTheDocument()
  })
})

describe('deep links into other tabs (real content)', () => {
  // jsdom doesn't perform a real browser's default action for an <a href="#..."> click, so this
  // proves the mechanism a card link relies on directly: the card renders the exact hash route
  // `useBrowserRouteSync` (see `features/browser`) reads, and following it (as a real click would)
  // opens that tab. Browser.test.tsx covers the sync hook itself in more depth.
  it("a card's href is the hash route that opens the tab it names", async () => {
    // Real timers: react-router's hash listener and React's own scheduling both need the event
    // loop to actually turn, which fake timers (this file's default, for deterministic Flack
    // typing/delay tests) would otherwise freeze.
    vi.useRealTimers()
    const store = createGameStore({ config: createGameConfig(), storage: noStorage, timers })
    render(<App store={store} />)
    act(() =>
      store.getState().dispatch({
        type: 'applyEffect',
        effect: {
          type: 'flackMessage',
          channel: 'platform',
          from: 'arghcd',
          text: 'Synced billing.',
          card: {
            title: 'billing synced',
            fields: [{ label: 'App', value: 'billing' }],
            href: '#/argh-cd/apps/billing',
            linkLabel: 'Open Argh CD',
          },
        },
      })
    )
    const link = screen.getByRole('link', { name: 'Open Argh CD' })
    expect(link).toHaveAttribute('href', '#/argh-cd/apps/billing')

    act(() => {
      window.location.hash = link.getAttribute('href')!
    })
    expect(await screen.findByRole('tab', { name: 'Argh CD', selected: true })).toBeInTheDocument()
    expect(store.getState().game.ui.activeTab).toBe('arghcd')
  })
})
