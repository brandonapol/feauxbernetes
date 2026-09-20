import type { GameConfig } from '../engine/story/types'
import { CHANNELS, DEFAULT_CHANNEL, MENTOR_CHANNEL } from './channels'
import { CHAPTERS } from './chapters'
import { characters } from './characters'
import { GENERAL_QUESTIONS, MENTOR_FAQ } from './mentorFaq'
import { TEST_SUITES } from './testSuites'
import { WORLD_START } from './world'

/**
 * Assembles the engine's `GameConfig` from `src/content`. `main.tsx` calls this once, at startup.
 * Assembles the engine's `GameConfig` from `src/content`. `main.tsx` calls this once, at startup.
 */
export function createGameConfig(): GameConfig {
  return {
    chapters: CHAPTERS,
    characters,
    channels: CHANNELS,
    defaultChannel: DEFAULT_CHANNEL,
    startTime: WORLD_START,
    mentor: { characterId: 'kai', channel: MENTOR_CHANNEL, entries: MENTOR_FAQ },
    mentorGeneralQuestions: GENERAL_QUESTIONS,
    testSuites: TEST_SUITES,
  }
}
