import { describe, expect, it } from 'vitest'

import { GAME_STATE_VERSION, blankState, type GameState } from '../engine/game'
import { toyConfig } from '../engine/story/__fixtures__/toyChapter'
import {
  MAX_SAVED_CLUSTER_EVENTS,
  MAX_SAVED_MESSAGES,
  STORAGE_KEY,
  browserStorage,
  clearSave,
  loadSave,
  writeSave,
  type StorageLike,
} from './persistence'

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

function withMessages(state: GameState, count: number): GameState {
  const messages = Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    channel: 'team',
    from: 'sam',
    text: `hello ${i}`,
    time: state.clock.now + i,
  }))
  return { ...state, flack: { ...state.flack, messages } }
}

function withClusterEvents(state: GameState, count: number): GameState {
  const clusterEvents = Array.from({ length: count }, (_, i) => ({
    at: state.clock.now + i,
    kind: 'Scheduled' as const,
    raw: `Scheduled search-${i} to box-1`,
    english: `Starting a new copy of search on box-1 (${i}).`,
    appId: 'search',
  }))
  return { ...state, clusterEvents }
}

describe('loadSave / writeSave round trip', () => {
  it('loads back exactly what was written', () => {
    const storage = memoryStorage()
    const game = blankState(config)
    writeSave(storage, game, [])
    const loaded = loadSave(storage)
    expect(loaded).toEqual({
      kind: 'loaded',
      save: { version: GAME_STATE_VERSION, game, scheduled: [] },
    })
  })

  it('is empty when nothing has been saved', () => {
    expect(loadSave(memoryStorage())).toEqual({ kind: 'empty' })
  })

  it('is empty when there is no storage at all', () => {
    expect(loadSave(undefined)).toEqual({ kind: 'empty' })
  })

  it('discards unparsable JSON', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, 'not json')
    expect(loadSave(storage)).toEqual({ kind: 'discarded' })
  })

  it('discards a save from an incompatible schema version', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: GAME_STATE_VERSION + 1, game: {} }))
    expect(loadSave(storage)).toEqual({ kind: 'discarded' })
  })

  it('discards a save with no version at all', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ game: {} }))
    expect(loadSave(storage)).toEqual({ kind: 'discarded' })
  })
})

describe('capping for storage', () => {
  it('keeps only the most recent MAX_SAVED_MESSAGES Flack messages', () => {
    const storage = memoryStorage()
    const game = withMessages(blankState(config), MAX_SAVED_MESSAGES + 50)
    writeSave(storage, game, [])
    const loaded = loadSave(storage)
    if (loaded.kind !== 'loaded') throw new Error('expected a loaded save')
    expect(loaded.save.game.flack.messages).toHaveLength(MAX_SAVED_MESSAGES)
    expect(loaded.save.game.flack.messages.at(-1)?.id).toBe(`msg-${MAX_SAVED_MESSAGES + 49}`)
  })

  it('keeps only the most recent MAX_SAVED_CLUSTER_EVENTS cluster events', () => {
    const storage = memoryStorage()
    const game = withClusterEvents(blankState(config), MAX_SAVED_CLUSTER_EVENTS + 50)
    writeSave(storage, game, [])
    const loaded = loadSave(storage)
    if (loaded.kind !== 'loaded') throw new Error('expected a loaded save')
    expect(loaded.save.game.clusterEvents).toHaveLength(MAX_SAVED_CLUSTER_EVENTS)
    expect(loaded.save.game.clusterEvents.at(-1)?.raw).toBe(
      `Scheduled search-${MAX_SAVED_CLUSTER_EVENTS + 49} to box-1`
    )
  })

  it("doesn't touch a save that's already under the caps", () => {
    const storage = memoryStorage()
    const game = withMessages(blankState(config), 3)
    writeSave(storage, game, [])
    const loaded = loadSave(storage)
    if (loaded.kind !== 'loaded') throw new Error('expected a loaded save')
    expect(loaded.save.game.flack.messages).toHaveLength(3)
  })
})

describe('failure modes', () => {
  it('writeSave returns false and never throws when storage throws', () => {
    expect(writeSave(brokenStorage, blankState(config), [])).toBe(false)
  })

  it('loadSave discards (never throws) when storage throws', () => {
    expect(loadSave(brokenStorage)).toEqual({ kind: 'discarded' })
  })

  it('clearSave never throws when storage throws', () => {
    expect(() => clearSave(brokenStorage)).not.toThrow()
  })

  it('writeSave and loadSave are no-ops without storage', () => {
    expect(writeSave(undefined, blankState(config), [])).toBe(false)
    expect(loadSave(undefined)).toEqual({ kind: 'empty' })
  })

  it('browserStorage falls back to undefined outside a browser (or when it throws)', () => {
    // jsdom provides window.localStorage, so this just proves it doesn't throw either way.
    expect(() => browserStorage()).not.toThrow()
  })
})
