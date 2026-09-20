import type { GameConfig } from '../engine/story/types'
import { CHANNELS, DEFAULT_CHANNEL } from './channels'
import { CHAPTERS } from './chapters'
import { characters } from './characters'
import { WORLD_START } from './world'

/**
 * Assembles the engine's `GameConfig` from `src/content`. `main.tsx` calls this once, at startup.
 * `chapters` and `channels` are still placeholders (see their own files) until chapter content
 * (#18 onward) and Flack (#12) land — everything else here is real.
 */
export function createGameConfig(): GameConfig {
  return {
    chapters: CHAPTERS,
    characters,
    channels: CHANNELS,
    defaultChannel: DEFAULT_CHANNEL,
    startTime: WORLD_START,
  }
}
