import { createStore, type StoreApi } from 'zustand/vanilla'

import {
  blankState,
  initialState,
  reduce,
  startChapter,
  type Action,
  type GameState,
  type ReduceResult,
} from '../engine/game'
import type { Effect, GameConfig } from '../engine/story/types'
import {
  browserStorage,
  clearSave,
  loadSave,
  writeSave,
  type ScheduledEffect,
  type StorageLike,
} from './persistence'

/** How long before a delayed Flack message arrives the "typing…" indicator appears. */
export const TYPING_LEAD_MS = 2000
/**
 * A save is written at most this often. It's a throttle, not a debounce: the store ticks the fake
 * clock every `TICK_INTERVAL_MS`, and a plain debounce (reschedule on every call) would never fire
 * while ticks keep landing. The first change in a quiet window schedules the write; further
 * changes before it fires don't push it back.
 */
export const SAVE_DEBOUNCE_MS = 500
/** Real ms between fake-clock ticks. Every engine's clock-driven behaviour reads `game.clock.now`. */
export const TICK_INTERVAL_MS = 200
/** `?fast=1` (for E2E runs) makes the fake clock run this many times faster than real time. */
export const FAST_CLOCK_FACTOR = 100

export interface Typing {
  channel: string
  from: string
}

export interface GameStoreState {
  /** Content and commands. Never changes; here so panels can look up chapters and steps. */
  config: GameConfig
  game: GameState
  /** Effects waiting to fire, at a fake-clock time. Saved with the game so a reload keeps them. */
  scheduled: ScheduledEffect[]
  /** Characters currently "typing", derived from the scheduled queue and the fake clock. */
  typing: Typing[]
  debug: boolean
  /** True when the fake clock (and everything that rides on it) is stopped. See `pause`. */
  paused: boolean
  /** Set when an unusable save was thrown away at startup, so the UI can say so. */
  notice?: 'save-discarded'
  dispatch: (action: Action) => void
  restartChapter: () => void
  resetEverything: () => void
  dismissNotice: () => void
  /** Writes a pending (debounced) save now. Call it when the page is going away. */
  flushSave: () => void
  /** Stops the fake clock. Delayed effects and cluster reconciles freeze exactly where they are. */
  pause: () => void
  /** Restarts the fake clock where `pause` left it. */
  resume: () => void
}

/**
 * Everything the store needs from the outside clock — only relative delays, never a wall-clock
 * read. The fake clock is entirely a function of ticks (see `tick` below), so nothing here needs
 * to know what time it "really" is.
 */
export interface Timers {
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
  setInterval: (callback: () => void, ms: number) => unknown
  clearInterval: (handle: unknown) => void
}

export interface GameStoreOptions {
  config: GameConfig
  storage?: StorageLike
  timers?: Timers
  /** `location.search`, for `?chapter=`, `?debug=1` and `?fast=1`. */
  search?: string
}

export type GameStore = StoreApi<GameStoreState>

const browserTimers: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
}

function isTyping(effect: Effect): effect is Extract<Effect, { type: 'flackMessage' }> {
  return effect.type === 'flackMessage' && effect.from !== 'player'
}

/**
 * Wraps the pure `reduce(config, state, action)` engine in a Zustand store: it owns the fake
 * clock's real interval, the scheduler for delayed effects, pause/resume, and persistence. See
 * planning.md → "One clock to rule them all" and "State, persistence and reset".
 */
export function createGameStore(options: GameStoreOptions): GameStore {
  const { config } = options
  const storage = options.storage ?? browserStorage()
  const timers = options.timers ?? browserTimers
  const params = new URLSearchParams(options.search ?? '')
  const rate = params.get('fast') === '1' ? FAST_CLOCK_FACTOR : 1
  let saveHandle: unknown
  let intervalHandle: unknown
  let nextId = 1

  const store = createStore<GameStoreState>()(() => ({
    config,
    game: blankState(config),
    scheduled: [],
    typing: [],
    debug: params.get('debug') === '1',
    paused: false,
    dispatch: () => undefined,
    restartChapter: () => undefined,
    resetEverything: () => undefined,
    dismissNotice: () => undefined,
    flushSave: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
  }))

  const saveNow = () => {
    saveHandle = undefined
    const { game, scheduled } = store.getState()
    writeSave(storage, game, scheduled)
  }

  const persistSoon = () => {
    if (saveHandle !== undefined) return
    saveHandle = timers.setTimeout(saveNow, SAVE_DEBOUNCE_MS)
  }

  const flushSave = () => {
    if (saveHandle === undefined) return
    timers.clearTimeout(saveHandle)
    saveNow()
  }

  /** Recomputes who's "typing", from the scheduled queue and the current fake clock. */
  const updateTyping = () => {
    const { game, scheduled } = store.getState()
    const now = game.clock.now
    const typing = scheduled
      .filter((entry) => isTyping(entry.effect) && entry.dueAt - TYPING_LEAD_MS <= now)
      .map((entry) => {
        const effect = entry.effect as Extract<Effect, { type: 'flackMessage' }>
        return { channel: effect.channel, from: effect.from }
      })
    store.setState({ typing })
  }

  const scheduleEffects = (effects: Effect[]) => {
    if (effects.length === 0) return
    const now = store.getState().game.clock.now
    const entries: ScheduledEffect[] = effects.map((effect) => ({
      id: `fx-${nextId++}`,
      effect,
      dueAt: now + (effect.delayMs ?? 0),
    }))
    store.setState((s) => ({ scheduled: [...s.scheduled, ...entries] }))
  }

  /**
   * Fires every scheduled effect whose fake-clock due time has arrived, earliest first. Firing one
   * can itself schedule more (a reply chain), so this keeps going until nothing more is due.
   */
  const drainDue = () => {
    for (;;) {
      const { game, scheduled } = store.getState()
      const due = scheduled
        .filter((entry) => entry.dueAt <= game.clock.now)
        .sort((a, b) => a.dueAt - b.dueAt)[0]
      if (!due) return
      store.setState((s) => ({ scheduled: s.scheduled.filter((entry) => entry.id !== due.id) }))
      commit(reduce(config, store.getState().game, { type: 'applyEffect', effect: due.effect }))
    }
  }

  function commit(result: ReduceResult) {
    store.setState({ game: result.state })
    scheduleEffects(result.effects)
    drainDue()
    updateTyping()
    persistSoon()
  }

  const cancelAll = () => {
    store.setState({ scheduled: [], typing: [] })
  }

  const dispatch = (action: Action) => {
    if (action.type === 'restartChapter' || action.type === 'startChapter') cancelAll()
    commit(reduce(config, store.getState().game, action))
  }

  const tick = () => {
    dispatch({ type: 'tick', deltaMs: TICK_INTERVAL_MS * rate })
  }

  const startTicking = () => {
    if (intervalHandle !== undefined) return
    intervalHandle = timers.setInterval(tick, TICK_INTERVAL_MS)
  }

  const stopTicking = () => {
    if (intervalHandle === undefined) return
    timers.clearInterval(intervalHandle)
    intervalHandle = undefined
  }

  const pause = () => {
    if (store.getState().paused) return
    stopTicking()
    store.setState({ paused: true })
  }

  const resume = () => {
    if (!store.getState().paused) return
    store.setState({ paused: false })
    startTicking()
  }

  const resetEverything = () => {
    cancelAll()
    if (saveHandle !== undefined) timers.clearTimeout(saveHandle)
    saveHandle = undefined
    clearSave(storage)
    store.setState({ paused: false, notice: undefined })
    commit(initialState(config))
    startTicking()
  }

  store.setState({
    dispatch,
    restartChapter: () => dispatch({ type: 'restartChapter' }),
    resetEverything,
    dismissNotice: () => store.setState({ notice: undefined }),
    flushSave,
    pause,
    resume,
  })

  // Starting point: an explicit ?chapter= jump, then a save, then a new game.
  const jump = params.get('chapter')
  const jumpTo = jump
    ? config.chapters.find((chapter) => chapter.id === jump || chapter.id.startsWith(`${jump}-`))
    : undefined
  if (jumpTo) {
    commit(startChapter(config, blankState(config), jumpTo.id))
  } else {
    const loaded = loadSave(storage)
    if (loaded.kind === 'loaded') {
      store.setState({ game: loaded.save.game, scheduled: loaded.save.scheduled })
      nextId =
        Math.max(0, ...loaded.save.scheduled.map((entry) => Number(entry.id.slice(3)) || 0)) + 1
      drainDue()
      updateTyping()
    } else {
      if (loaded.kind === 'discarded') store.setState({ notice: 'save-discarded' })
      commit(initialState(config))
    }
  }

  startTicking()

  return store
}
