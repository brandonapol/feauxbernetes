import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setWish as setClusterWish } from '../engine/cluster'
import { approvePR, createGitOps, mergePR, openPR, DEPLOY_REPO } from '../engine/gitops'
import { T0, toyConfig } from '../engine/story/__fixtures__/toyChapter'
import {
  createGameStore,
  FAST_CLOCK_FACTOR,
  SAVE_DEBOUNCE_MS,
  TICK_INTERVAL_MS,
  TYPING_LEAD_MS,
  type Timers,
} from './gameStore'
import { MAX_SAVED_MESSAGES, STORAGE_KEY, type StorageLike } from './persistence'

const config = toyConfig()

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const brokenStorage: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

const timers: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

/** Plays the toy chapter up to the step whose completion schedules Sam's delayed message. */
function playToWish(store: ReturnType<typeof createGameStore>) {
  const { dispatch } = store.getState()
  dispatch({ type: 'clickTarget', targetId: 'start' })
  dispatch({ type: 'setPlayerName', name: 'Ada Lovelace' })
  dispatch({ type: 'chooseOption', stepId: 'wish', optionId: 'three' })
}

const hasSamMessage = (store: ReturnType<typeof createGameStore>) =>
  store.getState().game.flack.messages.some((m) => m.id === 'sam-hi')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-17T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('game store', () => {
  it('starts a new game at the first step', () => {
    const store = createGameStore({ config, storage: memoryStorage(), timers })
    expect(store.getState().game.story).toMatchObject({ chapterId: 'toy', stepIndex: 0 })
    expect(store.getState().game.flack.messages.map((m) => m.id)).toEqual(['welcome'])
    expect(store.getState().game.clock.now).toBe(T0)
    expect(store.getState().paused).toBe(false)
  })

  it('fires a delayed effect at the right fake time, with a typing indicator first', () => {
    const store = createGameStore({ config, storage: memoryStorage(), timers })
    playToWish(store)
    expect(store.getState().scheduled).toHaveLength(1)
    expect(hasSamMessage(store)).toBe(false)
    expect(store.getState().typing).toEqual([])

    // Delay is 3000 fake ms; 60 fake ms have already passed (three actions, 20 fake ms each).
    vi.advanceTimersByTime(3000 - TYPING_LEAD_MS)
    expect(store.getState().typing).toEqual([{ channel: 'team', from: 'sam' }])
    expect(hasSamMessage(store)).toBe(false)

    vi.advanceTimersByTime(TYPING_LEAD_MS)
    expect(hasSamMessage(store)).toBe(true)
    expect(store.getState().typing).toEqual([])
    expect(store.getState().scheduled).toEqual([])
  })

  it("doesn't fire a delayed effect early", () => {
    const store = createGameStore({ config, storage: memoryStorage(), timers })
    playToWish(store)
    vi.advanceTimersByTime(3000 - TICK_INTERVAL_MS)
    expect(hasSamMessage(store)).toBe(false)
  })

  it('the tick loop advances the fake clock at a fixed rate', () => {
    const store = createGameStore({ config, storage: memoryStorage(), timers })
    const before = store.getState().game.clock.now
    vi.advanceTimersByTime(TICK_INTERVAL_MS * 4)
    expect(store.getState().game.clock.now).toBe(before + TICK_INTERVAL_MS * 4)
  })

  describe('pause / resume', () => {
    it('pausing freezes clock-driven effects; resuming continues exactly where it stopped', () => {
      const store = createGameStore({ config, storage: memoryStorage(), timers })
      playToWish(store)

      // Get partway there (typing has started) before pausing.
      vi.advanceTimersByTime(3000 - TYPING_LEAD_MS)
      const clockAtPause = store.getState().game.clock.now
      expect(store.getState().typing).toEqual([{ channel: 'team', from: 'sam' }])

      store.getState().pause()
      expect(store.getState().paused).toBe(true)

      // A lot of real time passes. Nothing moves: the clock, the typing state and the message.
      vi.advanceTimersByTime(60_000)
      expect(store.getState().game.clock.now).toBe(clockAtPause)
      expect(store.getState().typing).toEqual([{ channel: 'team', from: 'sam' }])
      expect(hasSamMessage(store)).toBe(false)

      store.getState().resume()
      expect(store.getState().paused).toBe(false)

      // The remaining fake time to the message's due time still has to pass, from where it left off.
      vi.advanceTimersByTime(TYPING_LEAD_MS - TICK_INTERVAL_MS)
      expect(hasSamMessage(store)).toBe(false)
      vi.advanceTimersByTime(TICK_INTERVAL_MS)
      expect(hasSamMessage(store)).toBe(true)
    })

    it('pause is a no-op if already paused, and resume a no-op if already running', () => {
      const store = createGameStore({ config, storage: memoryStorage(), timers })
      store.getState().pause()
      store.getState().pause()
      expect(store.getState().paused).toBe(true)
      store.getState().resume()
      store.getState().resume()
      expect(store.getState().paused).toBe(false)
    })
  })

  it('saves (throttled) and a reload mid-delay still delivers the effect at the right fake time', () => {
    const storage = memoryStorage()
    const first = createGameStore({ config, storage, timers })
    playToWish(first)
    expect(storage.data.has(STORAGE_KEY)).toBe(false)

    // The save is throttled, not simply debounced: it fires SAVE_DEBOUNCE_MS after the first
    // change even though ticks keep landing every TICK_INTERVAL_MS in between.
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)
    expect(storage.data.has(STORAGE_KEY)).toBe(true)
    const savedClock = first.getState().game.clock.now

    // The tab closes: nothing ticks (or saves over the top of what's there) any more. However
    // much real time passes while it's closed, no fake time passes with it.
    first.getState().pause()
    vi.advanceTimersByTime(999_999)

    const second = createGameStore({ config, storage, timers })
    expect(second.getState().game.clock.now).toBe(savedClock)
    expect(second.getState().game.story.stepIndex).toBe(first.getState().game.story.stepIndex)
    expect(hasSamMessage(second)).toBe(false)

    // Due at fake T0+3060; `savedClock` fake ms have already passed.
    const remaining = T0 + 60 + 3000 - savedClock
    vi.advanceTimersByTime(remaining - TICK_INTERVAL_MS)
    expect(hasSamMessage(second)).toBe(false)
    vi.advanceTimersByTime(TICK_INTERVAL_MS)
    expect(hasSamMessage(second)).toBe(true)
  })

  it('flushSave writes a pending save straight away, so a quick reload loses nothing', () => {
    const storage = memoryStorage()
    const first = createGameStore({ config, storage, timers })
    playToWish(first)
    expect(storage.data.has(STORAGE_KEY)).toBe(false)
    first.getState().flushSave()
    expect(storage.data.has(STORAGE_KEY)).toBe(true)
    expect(createGameStore({ config, storage, timers }).getState().game.story.stepIndex).toBe(
      first.getState().game.story.stepIndex
    )
  })

  it('keeps working when storage throws', () => {
    const store = createGameStore({ config, storage: brokenStorage, timers })
    playToWish(store)
    vi.advanceTimersByTime(3000)
    expect(hasSamMessage(store)).toBe(true)
    expect(() => store.getState().resetEverything()).not.toThrow()
  })

  it('discards a corrupt or incompatible save with a notice', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{"version": 999}')
    const store = createGameStore({ config, storage, timers })
    expect(store.getState().notice).toBe('save-discarded')
    expect(store.getState().game.story.chapterId).toBe('toy')
    store.getState().dismissNotice()
    expect(store.getState().notice).toBeUndefined()

    storage.setItem(STORAGE_KEY, 'not json')
    expect(createGameStore({ config, storage, timers }).getState().notice).toBe('save-discarded')
  })

  it('caps saved Flack messages so a long session stays a reasonable size', () => {
    const storage = memoryStorage()
    const store = createGameStore({ config, storage, timers })
    for (let i = 0; i < MAX_SAVED_MESSAGES + 10; i++) {
      store.getState().dispatch({
        type: 'applyEffect',
        effect: { type: 'flackMessage', channel: 'team', from: 'sam', text: `msg ${i}` },
      })
    }
    store.getState().flushSave()
    const saved = JSON.parse(storage.data.get(STORAGE_KEY)!)
    expect(saved.game.flack.messages).toHaveLength(MAX_SAVED_MESSAGES)
  })

  it('reset everything clears storage, pending effects and progress, and un-pauses', () => {
    const storage = memoryStorage()
    const store = createGameStore({ config, storage, timers })
    playToWish(store)
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)
    store.getState().pause()

    store.getState().resetEverything()
    expect(storage.data.has(STORAGE_KEY)).toBe(false)
    expect(store.getState().scheduled).toEqual([])
    expect(store.getState().game.story.stepIndex).toBe(0)
    expect(store.getState().paused).toBe(false)

    vi.advanceTimersByTime(10_000)
    expect(hasSamMessage(store)).toBe(false)
  })

  it('restart chapter cancels pending effects', () => {
    const store = createGameStore({ config, storage: memoryStorage(), timers })
    playToWish(store)
    store.getState().restartChapter()
    vi.advanceTimersByTime(10_000)
    expect(hasSamMessage(store)).toBe(false)
    expect(store.getState().game.story.stepIndex).toBe(0)
  })

  it('?fast=1 makes the fake clock (and its delayed effects) run a hundred times faster', () => {
    const store = createGameStore({ config, storage: memoryStorage(), timers, search: '?fast=1' })
    playToWish(store)
    expect(hasSamMessage(store)).toBe(false)
    // A single real tick now advances the fake clock by TICK_INTERVAL_MS * FAST_CLOCK_FACTOR,
    // which comfortably clears the 3000 fake ms delay.
    expect(TICK_INTERVAL_MS * FAST_CLOCK_FACTOR).toBeGreaterThan(3000)
    vi.advanceTimersByTime(TICK_INTERVAL_MS)
    expect(hasSamMessage(store)).toBe(true)
  })

  it('?chapter= jumps straight to a chapter and ?debug=1 sets the flag', () => {
    const storage = memoryStorage()
    const store = createGameStore({ config, storage, timers, search: '?chapter=epilogue&debug=1' })
    expect(store.getState().game.story.chapterId).toBe('epilogue')
    expect(store.getState().debug).toBe(true)
  })
})

describe('the GitOps tick, wired into the live store (#53)', () => {
  it('a merged PR auto-syncs after the delay, landing in gitopsEvents and #deploys', () => {
    const store = createGameStore({ config, storage: memoryStorage(), timers })
    const before = store.getState().game.clock.now

    // Simulate GitNub's "Merge" button: #15/#16 haven't landed the action that does this from a
    // dispatch yet, so the test drives the gitops engine directly, the way `whereIsMyChange.test.ts`
    // does, then hands the result to the store as if a `mergePR` action had just run.
    const gitops = store.getState().game.gitops
    const opened = openPR(
      gitops,
      {
        repo: DEPLOY_REPO,
        title: 'Run 3 copies of search@v2',
        author: 'Ada Lovelace',
        change: { kind: 'wish', app: 'search', wish: { app: 'search', version: 'v2', copies: 3 } },
      },
      before
    )
    const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Kai')
    const merged = mergePR(approved, opened.pullRequest.id, before)
    store.setState((s) => ({ game: { ...s.game, gitops: merged.gitops } }))

    expect(store.getState().game.gitopsEvents).toEqual([])
    expect(store.getState().game.flack.messages.some((m) => m.channel === 'deploys')).toBe(false)

    // autoSyncDelayMs is 4000 for a brand-new game's gitops (see `blankGitOps` in `engine/game.ts`).
    vi.advanceTimersByTime(4000 + TICK_INTERVAL_MS)

    const autoSync = store.getState().game.gitopsEvents.find((e) => e.kind === 'AutoSync')
    expect(autoSync).toBeDefined()
    expect(autoSync?.appId).toBe('search')
    expect(store.getState().game.cluster.wishes.search).toEqual({
      app: 'search',
      version: 'v2',
      copies: 3,
    })

    const deployMessage = store.getState().game.flack.messages.find((m) => m.channel === 'deploys')
    expect(deployMessage?.from).toBe('arghcd')
    expect(deployMessage?.text).toContain('search')
  })

  it('drift the learner causes by hand self-heals on the clock', () => {
    const store = createGameStore({ config, storage: memoryStorage(), timers })
    const before = store.getState().game.clock.now

    // GitNub and the cluster already agree on search@v1 x3 before the drift.
    const gitops = createGitOps({
      config: { autoSyncDelayMs: 4000, selfHealDelayMs: 6000 },
      wishes: [{ app: 'search', version: 'v1', copies: 3 }],
    })
    const cluster = setClusterWish(
      store.getState().game.cluster,
      { app: 'search', version: 'v1', copies: 3 },
      before
    )
    store.setState((s) => ({ game: { ...s.game, gitops, cluster } }))

    // The learner changes it by hand in the Ops Console, bypassing GitNub entirely.
    store.getState().dispatch({ type: 'chooseWish', app: 'search', version: 'v1', copies: 5 })
    expect(store.getState().game.cluster.wishes.search).toEqual({
      app: 'search',
      version: 'v1',
      copies: 5,
    })

    // One tick notices the drift and schedules self-heal; it doesn't revert it immediately.
    vi.advanceTimersByTime(TICK_INTERVAL_MS)
    expect(store.getState().game.gitopsEvents).toEqual([])
    expect(store.getState().game.cluster.wishes.search?.copies).toBe(5)

    // selfHealDelayMs is 6000 from the point the drift was first noticed.
    vi.advanceTimersByTime(6000 + TICK_INTERVAL_MS)

    const selfHeal = store.getState().game.gitopsEvents.find((e) => e.kind === 'SelfHeal')
    expect(selfHeal).toBeDefined()
    expect(store.getState().game.cluster.wishes.search).toEqual({
      app: 'search',
      version: 'v1',
      copies: 3,
    })
    const deployMessage = store.getState().game.flack.messages.find((m) => m.channel === 'deploys')
    expect(deployMessage?.from).toBe('arghcd')
    expect(deployMessage?.text.toLowerCase()).toContain('drift')
  })
})

describe('determinism', () => {
  it('the same sequence of actions produces the same state, played through the store', () => {
    const play = () => {
      const store = createGameStore({ config, storage: memoryStorage(), timers })
      playToWish(store)
      vi.advanceTimersByTime(3000)
      store.getState().dispatch({ type: 'openTab', tab: 'gitnub' })
      return store.getState().game
    }

    const first = play()
    vi.setSystemTime(new Date('2026-09-17T12:00:00Z'))
    const second = play()
    expect(second).toEqual(first)
  })
})
