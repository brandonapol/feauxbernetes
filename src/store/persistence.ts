import { GAME_STATE_VERSION, type GameState } from '../engine/game'
import type { Effect } from '../engine/story/types'

export const STORAGE_KEY = 'feauxbernetes:v1'

/** How many Flack messages and cluster events a save keeps. Older ones are dropped, oldest first. */
export const MAX_SAVED_MESSAGES = 500
export const MAX_SAVED_CLUSTER_EVENTS = 200

export interface ScheduledEffect {
  id: string
  effect: Effect
  /**
   * Fake-clock ms (`GameState.clock.now` units) when this effect should fire — not wall-clock
   * time. That's what makes a reload land it at "the right fake time" regardless of how long the
   * tab was closed, and what lets pausing the store's ticks freeze it in place (see
   * `gameStore.ts`).
   */
  dueAt: number
}

export interface SaveFile {
  version: number
  game: GameState
  scheduled: ScheduledEffect[]
}

/** The subset of the Web Storage API we use, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type LoadResult =
  | { kind: 'loaded'; save: SaveFile }
  | { kind: 'empty' }
  /** A save exists but can't be used (corrupt, or from an incompatible version). */
  | { kind: 'discarded' }

/**
 * Upgrades an older save to the current shape. There's only one version so far; when the shape of
 * GameState changes, bump GAME_STATE_VERSION and add a step here, or return undefined to reset.
 */
export function migrate(save: { version: number } & Record<string, unknown>): SaveFile | undefined {
  if (save.version === GAME_STATE_VERSION) return save as unknown as SaveFile
  return undefined
}

export function loadSave(storage: StorageLike | undefined): LoadResult {
  if (!storage) return { kind: 'empty' }
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { kind: 'empty' }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as SaveFile).version !== 'number') {
      return { kind: 'discarded' }
    }
    const save = migrate(parsed as SaveFile & Record<string, unknown>)
    return save ? { kind: 'loaded', save } : { kind: 'discarded' }
  } catch {
    return { kind: 'discarded' }
  }
}

/** Trims the parts of the save that can grow without bound over a long session. */
function capForSave(game: GameState): GameState {
  const messages =
    game.flack.messages.length <= MAX_SAVED_MESSAGES
      ? game.flack.messages
      : game.flack.messages.slice(-MAX_SAVED_MESSAGES)
  const clusterEvents =
    game.clusterEvents.length <= MAX_SAVED_CLUSTER_EVENTS
      ? game.clusterEvents
      : game.clusterEvents.slice(-MAX_SAVED_CLUSTER_EVENTS)
  if (messages === game.flack.messages && clusterEvents === game.clusterEvents) return game
  return { ...game, flack: { ...game.flack, messages }, clusterEvents }
}

/** Returns false if the write failed (quota, privacy mode); the game carries on either way. */
export function writeSave(
  storage: StorageLike | undefined,
  game: GameState,
  scheduled: ScheduledEffect[]
): boolean {
  if (!storage) return false
  try {
    const save: SaveFile = { version: GAME_STATE_VERSION, game: capForSave(game), scheduled }
    storage.setItem(STORAGE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

export function clearSave(storage: StorageLike | undefined): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do: the next write will overwrite whatever is there.
  }
}

/** `window.localStorage`, or undefined when even touching it throws (privacy mode, SSR, …). */
export function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}
