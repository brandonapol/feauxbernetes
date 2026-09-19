import { blankState, reduce, startChapter, type Action, type GameState } from '../game'
import { currentStep } from './runner'
import type { Effect, GameConfig } from './types'

export interface PlayResult {
  state: GameState
  /** Ids of steps completed in this chapter, in order. */
  trace: string[]
}

/** Chapters shouldn't need more steps than this to finish; a bigger number means a stuck goal. */
const MAX_STEPS = 200

/** Applies every pending effect at once (and any they schedule), ignoring delays. */
export function flushEffects(config: GameConfig, state: GameState, pending: Effect[]): GameState {
  let current = state
  const queue = [...pending]
  let guard = 0
  while (queue.length > 0) {
    if (++guard > 500) throw new Error('flushEffects: effects keep scheduling more effects')
    const effect = queue.shift()!
    const result = reduce(config, current, { type: 'applyEffect', effect })
    current = result.state
    queue.push(...result.effects)
  }
  return current
}

/** Runs actions one after another, flushing delayed effects after each, like a very fast player. */
export function play(config: GameConfig, state: GameState, actions: Action[]): GameState {
  let current = state
  for (const action of actions) {
    const result = reduce(config, current, action)
    current = flushEffects(config, result.state, result.effects)
  }
  return current
}

/**
 * Plays `chapterId` from `from` (or a blank game) using each step's `solution` action, in order.
 * In `recoverability` mode, a `chooseOption` step's `wrongAnswers` are each tried — and asserted
 * not to advance the step — before the real solution. Throws with a specific message the moment
 * something doesn't behave (a wrong answer that advances, a solution that doesn't, a step with
 * neither a solution nor `optional: true`), instead of leaving the chapter to hang.
 */
function walk(
  config: GameConfig,
  chapterId: string,
  from: GameState | undefined,
  recoverability: boolean
): PlayResult {
  const started = startChapter(config, from ?? blankState(config), chapterId)
  let state = flushEffects(config, started.state, started.effects)

  for (let guard = 0; state.story.phase === 'playing'; guard++) {
    if (guard > MAX_STEPS) {
      throw new Error(`playChapter: "${chapterId}" never completed (a stuck step?)`)
    }
    const step = currentStep(config, state)
    if (!step) break

    if (recoverability) {
      for (const optionId of Object.keys(step.wrongAnswers ?? {})) {
        const beforeIndex = state.story.stepIndex
        const beforeChapter = state.story.chapterId
        state = play(config, state, [{ type: 'chooseOption', stepId: step.id, optionId }])
        if (state.story.stepIndex !== beforeIndex || state.story.chapterId !== beforeChapter) {
          throw new Error(
            `Recoverability: choosing "${optionId}" on step "${step.id}" advanced the story ` +
              'instead of just explaining the mistake'
          )
        }
      }
    }

    if (!step.solution) {
      if (!step.optional) {
        throw new Error(`playChapter: step "${step.id}" has no solution action to complete it`)
      }
      state = play(config, state, [{ type: 'skipStep' }])
      continue
    }

    const beforeIndex = state.story.stepIndex
    const beforeChapter = state.story.chapterId
    state = play(config, state, [step.solution])
    if (state.story.stepIndex === beforeIndex && state.story.chapterId === beforeChapter) {
      throw new Error(`playChapter: step "${step.id}"'s solution action did not complete it`)
    }
  }

  if (state.story.phase !== 'complete') {
    throw new Error(`playChapter: chapter "${chapterId}" did not reach "complete"`)
  }
  return { state, trace: state.story.completedSteps }
}

/**
 * The golden-path harness: start `chapterId` (from `from`, or a blank game) and play every step's
 * `solution` action in order, asserting the chapter completes. Every chapter ships with a test
 * built on this.
 */
export function playChapter(
  config: GameConfig,
  chapterId: string,
  options: { from?: GameState } = {}
): PlayResult {
  return walk(config, chapterId, options.from, false)
}

/**
 * Like `playChapter`, but for every `chooseOption` step it first tries each of `wrongAnswers`'
 * keys — asserting none of them advance the step — before playing the real solution. A chapter
 * that a wrong pick can dead-end fails here, in a test, instead of surfacing during playtesting.
 */
export function playChapterRecoverably(
  config: GameConfig,
  chapterId: string,
  options: { from?: GameState } = {}
): PlayResult {
  return walk(config, chapterId, options.from, true)
}
