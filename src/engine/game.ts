import type { Tab } from './events'
import { advanceStory, enterStep, skipStep } from './story/runner'
import type { Effect, GameConfig, KaiResponse, QuickReply } from './story/types'

export const GAME_STATE_VERSION = 1

/**
 * Placeholder engine state slots.
 *
 * `cluster`, `gitops`, `ci`, `telemetry`, `testlab` and `incident` are being built in parallel
 * (tickets #6, #7, #8, #9, #30, #31). Until each lands, its slot on `GameState` is this empty
 * shape. Swapping a slot for the real thing is a one-line change in this file: replace the
 * `type X = Record<string, never>` below with `import type { XState as X } from './x'`, and give
 * `blankState` its real initial value.
 */
// TODO(#6): swap for the cluster engine's real state (boxes, copies, wishes).
type ClusterState = Record<string, never>
// TODO(#7): swap for the GitOps engine's real state (config repo, app repos, Argh CD apps).
type GitOpsState = Record<string, never>
// TODO(#8): swap for the CI engine's real state (pipelines, jobs, test reports).
type CiState = Record<string, never>
// TODO(#9): swap for the telemetry engine's real state (series, logs, SLOs, alert rules).
type TelemetryState = Record<string, never>
// TODO(#30): swap for the test lab engine's real state (test steps, the fake app model).
type TestLabState = Record<string, never>
// TODO(#31): swap for the incident engine's real state (timeline, roles, scorecard).
type IncidentState = Record<string, never>

export interface FlackMessage {
  id: string
  channel: string
  /** Character id, or `player`. */
  from: string
  text: string
  time: number
  quickReplies?: QuickReply[]
  /** The quick reply the learner picked, once they have. */
  repliedWith?: string
}

export interface StoryState {
  chapterId: string
  /** `playing` a step, chapter `complete` (summary showing), or the whole game `finished`. */
  phase: 'playing' | 'complete' | 'finished'
  stepIndex: number
  completedSteps: string[]
  skippedSteps: string[]
  completedChapters: string[]
  /** Attempts (a `chooseOption` or `clickTarget`) on the current step that didn't complete it. */
  misses: number
  /** Reactions that have already fired, as `<stepId>:<reactionId>`. */
  firedReactions: string[]
  hintsShown: number
  solutionShown: boolean
  /** The most recent wrong pick on a `chooseOption` step, and Kai's response to it. */
  lastWrongAnswer?: { stepId: string; optionId: string; response: KaiResponse }
  /** The state when the chapter started, for "Restart chapter". */
  checkpoint?: Omit<GameState, 'story'> & { story: Omit<StoryState, 'checkpoint'> }
}

export interface GameState {
  version: number
  /** Fake seconds since the epoch. Every message and reconcile pass takes its time from here. */
  clock: { now: number }
  player: { name?: string }
  flack: {
    messages: FlackMessage[]
    /** Channel → number of messages seen. */
    readUpTo: Record<string, number>
    activeChannel?: string
  }
  ui: {
    activeTab: Tab
    unlockedTabs: Tab[]
    toast?: string
    /** The one overlay open over the browser column (Order Form, Test Builder, the page), if any. */
    overlay?: string
  }
  story: StoryState
  cluster: ClusterState
  gitops: GitOpsState
  ci: CiState
  telemetry: TelemetryState
  testlab: TestLabState
  incident: IncidentState
}

/**
 * What the learner (or a scheduled effect) makes happen. This union is open: as each sub-engine
 * lands (cluster #6, gitops #7, ci #8, telemetry #9, testlab #30, incident #31) it adds its own
 * action variants here (e.g. `chooseWish`, `syncApp`, `dropTestStep`, `ackPage`), and `reduce`
 * grows a case that routes to that engine's own reduce function. For now, only the actions every
 * chapter needs are defined.
 */
export type Action =
  /** Answers a multiple-choice question — the workhorse action for every quiz-shaped step. */
  | { type: 'chooseOption'; stepId: string; optionId: string }
  | { type: 'openTab'; tab: Tab }
  /** "Show me" and guided-tour goals: the learner clicked the highlighted element. */
  | { type: 'clickTarget'; targetId: string }
  | { type: 'openOverlay'; overlay: string }
  | { type: 'closeOverlay' }
  /** The only text besides search the learner ever types. */
  | { type: 'setPlayerName'; name: string }
  | { type: 'openChannel'; channel: string }
  | { type: 'flackReply'; messageId: string; replyId: string }
  | { type: 'applyEffect'; effect: Effect }
  | { type: 'showHint' }
  | { type: 'revealSolution' }
  | { type: 'dismissToast' }
  | { type: 'restartChapter' }
  | { type: 'startChapter'; chapterId: string }
  | { type: 'continueStory' }
  /** An optional step the learner chose not to do. */
  | { type: 'skipStep' }

export interface ReduceResult {
  state: GameState
  /** Effects with a delay, for the store to schedule. Everything else is already applied. */
  effects: Effect[]
}

/** Fake seconds that pass per action, so messages get plausible, increasing timestamps. */
const TICK = 20

export function blankState(config: GameConfig): GameState {
  return {
    version: GAME_STATE_VERSION,
    clock: { now: config.startTime },
    player: {},
    flack: {
      messages: [],
      readUpTo: {},
      activeChannel:
        config.defaultChannel ?? config.channels.find((channel) => channel.kind === 'channel')?.id,
    },
    ui: { activeTab: 'flack', unlockedTabs: ['flack'] },
    story: {
      chapterId: config.chapters[0]?.id ?? '',
      phase: 'playing',
      stepIndex: 0,
      completedSteps: [],
      skippedSteps: [],
      completedChapters: [],
      misses: 0,
      firedReactions: [],
      hintsShown: 0,
      solutionShown: false,
    },
    cluster: {},
    gitops: {},
    ci: {},
    telemetry: {},
    testlab: {},
    incident: {},
  }
}

/** A brand-new game, positioned at the first step of the first chapter. */
export function initialState(config: GameConfig): ReduceResult {
  return startChapter(config, blankState(config), config.chapters[0].id)
}

export function startChapter(config: GameConfig, from: GameState, chapterId: string): ReduceResult {
  const chapter = config.chapters.find((candidate) => candidate.id === chapterId)
  if (!chapter) throw new Error(`Unknown chapter: ${chapterId}`)
  const prepared = chapter.setup(
    {
      ...from,
      story: {
        ...from.story,
        chapterId,
        phase: 'playing',
        stepIndex: 0,
        completedSteps: [],
        skippedSteps: [],
        misses: 0,
        firedReactions: [],
        hintsShown: 0,
        solutionShown: false,
        lastWrongAnswer: undefined,
        checkpoint: undefined,
      },
    },
    config
  )
  const { checkpoint: _dropped, ...storyWithoutCheckpoint } = prepared.story // eslint-disable-line @typescript-eslint/no-unused-vars
  const withCheckpoint: GameState = {
    ...prepared,
    story: {
      ...prepared.story,
      checkpoint: { ...prepared, story: storyWithoutCheckpoint },
    },
  }
  return enterStep(config, withCheckpoint)
}

export function reduce(config: GameConfig, previous: GameState, action: Action): ReduceResult {
  const state: GameState = { ...previous, clock: { now: previous.clock.now + TICK } }

  switch (action.type) {
    case 'chooseOption':
      return advanceStory(config, state, [
        { type: 'optionChosen', stepId: action.stepId, optionId: action.optionId },
      ])

    case 'clickTarget':
      return advanceStory(config, state, [{ type: 'targetClicked', targetId: action.targetId }])

    case 'openTab':
    case 'showHint':
    case 'openOverlay':
    case 'closeOverlay':
      return advanceStory(config, state, [], [action])

    case 'setPlayerName':
      return advanceStory(config, state, [{ type: 'playerNamed', name: action.name }])

    case 'openChannel': {
      const count = state.flack.messages.filter((m) => m.channel === action.channel).length
      const next: GameState = {
        ...state,
        flack: {
          ...state.flack,
          activeChannel: action.channel,
          readUpTo: { ...state.flack.readUpTo, [action.channel]: count },
        },
      }
      return advanceStory(config, next, [{ type: 'channelOpened', channel: action.channel }])
    }

    case 'flackReply': {
      const message = state.flack.messages.find((m) => m.id === action.messageId)
      const reply = message?.quickReplies?.find((r) => r.id === action.replyId)
      if (!message || !reply || message.repliedWith) return { state: previous, effects: [] }
      const messages = state.flack.messages.map((m) =>
        m.id === message.id ? { ...m, repliedWith: reply.id } : m
      )
      const next: GameState = {
        ...state,
        flack: {
          ...state.flack,
          messages: [
            ...messages,
            {
              id: `reply-${message.id}`,
              channel: message.channel,
              from: 'player',
              text: reply.text,
              time: state.clock.now,
            },
          ],
        },
      }
      return advanceStory(config, next, [
        { type: 'flackReply', messageId: message.id, replyId: reply.id },
      ])
    }

    case 'applyEffect':
      return advanceStory(config, state, [], [{ ...action.effect, delayMs: undefined }])

    case 'revealSolution':
      return { state: { ...state, story: { ...state.story, solutionShown: true } }, effects: [] }

    case 'dismissToast':
      return { state: { ...state, ui: { ...state.ui, toast: undefined } }, effects: [] }

    case 'restartChapter': {
      const checkpoint = state.story.checkpoint
      if (!checkpoint) return { state: previous, effects: [] }
      return enterStep(config, {
        ...checkpoint,
        story: { ...checkpoint.story, checkpoint },
      })
    }

    case 'startChapter':
      return startChapter(config, state, action.chapterId)

    case 'skipStep':
      return skipStep(config, state)

    case 'continueStory': {
      if (state.story.phase !== 'complete') return { state: previous, effects: [] }
      const chapters = config.chapters
      const index = chapters.findIndex((chapter) => chapter.id === state.story.chapterId)
      const next = chapters[index + 1]
      if (!next) {
        return { state: { ...state, story: { ...state.story, phase: 'finished' } }, effects: [] }
      }
      return startChapter(config, state, next.id)
    }
  }
}
