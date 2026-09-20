import {
  crashCopy as crashClusterCopy,
  createCluster,
  reconcile,
  setBox as setClusterBox,
  setWish as setClusterWish,
  unplugCopy as unplugClusterCopy,
  type ClusterEvent,
  type ClusterState,
} from './cluster'
import type { Tab } from './events'
import type { GitOpsEvent } from './gitops'
import { applyEffect, openChannelState } from './story/effects'
import { advanceStory, enterStep, skipStep } from './story/runner'
import type { BotCard, Channel, Effect, GameConfig, KaiResponse, QuickReply } from './story/types'

// Bumped for #17: GameState grew a `statusPage` slot. No migration is worth writing this early —
// an old save just gets discarded (see `store/persistence.ts` → `migrate`) and the game restarts.
export const GAME_STATE_VERSION = 2

/**
 * Placeholder engine state slots.
 *
 * `gitops`, `ci`, `telemetry`, `testlab` and `incident` are being built in parallel (tickets #7,
 * #8, #9, #30, #31). Until each lands, its slot on `GameState` is this empty shape. Swapping a
 * slot for the real thing is a one-line change in this file: replace the
 * `type X = Record<string, never>` below with `import type { XState as X } from './x'`, and give
 * `blankState` its real initial value. `cluster` (#6) was the first to be wired in, in #4, since
 * the reconcile loop runs on the clock the store owns.
 */
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

/**
 * A plain-English one-liner for the Ops Console's "Checks" feed category (#13), matching the
 * `{ raw, english }` shape `engine/cluster/events.ts` and `engine/gitops/events.ts` already use.
 * The CI engine (#8) doesn't produce an event stream yet — it renders a whole report on demand
 * instead — so `GameState.ciNotices` is a stub nobody populates yet. Whichever future ticket wires
 * CI into the game loop (a pipeline finishing, checks passing/failing on a PR) should push entries
 * here, the same way `tick` below pushes `clusterEvents`.
 */
export interface CiNotice {
  at: number
  raw: string
  english: string
}

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
  /** A bot's structured attachment (a sync card, a page, a check run). See `BotCard`. */
  card?: BotCard
}

/**
 * status.inkwell.example's three components — customer-facing names for `web`, `search` and
 * `billing`. See planning.md → "inkwell.example" and #17.
 */
export type StatusComponentId = 'website' | 'search' | 'checkout'

export type StatusComponentState = 'operational' | 'degraded' | 'outage'

/**
 * One post to the status page, oldest first in `StatusPageState.updates`. The incident engine
 * (#31) is the intended writer, via `postStatusUpdate` below — this ticket (#17) only defines the
 * shape and renders whatever's here, since #31 doesn't exist yet. A component's badge on the
 * status page is the `state` of its most recent update, or `'operational'` (derived from cluster
 * health instead) before the first one ever lands — see `src/features/inkwell/site.ts`.
 */
export interface StatusUpdate {
  id: string
  /** Fake-clock time this was posted, for the feed's ordering and timestamps. */
  at: number
  component: StatusComponentId
  state: StatusComponentState
  /** Customer-facing prose, e.g. "We've identified the issue and are rolling out a fix." */
  message: string
}

export interface StatusPageState {
  updates: StatusUpdate[]
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
    /** Channels that don't live in content, e.g. the `#inc-<n>-<slug>` channel `declareIncident`
     * (#31) creates via the `createChannel` effect. Shown in the sidebar after `config.channels`. */
    dynamicChannels: Channel[]
  }
  ui: {
    activeTab: Tab
    unlockedTabs: Tab[]
    toast?: string
    /** The one overlay open over the browser column (Order Form, Test Builder, the page), if any. */
    overlay?: string
    /**
     * From Ch 4 on (planning.md → "Argh CD, part 2"): wishes made directly in the Ops Console get
     * undone by Argh CD, because GitNub is the source of truth. A chapter turns this on for good
     * by having its `setup` return `{ ...state, ui: { ...state.ui, gitOpsEnforced: true } }`; no
     * chapter ever needs to turn it back off. The Ops Console reads it to show the "Changes here
     * are temporary" banner (#13).
     */
    gitOpsEnforced?: boolean
  }
  story: StoryState
  cluster: ClusterState
  /** Cluster events from `reconcile`, oldest first, for the Ops Console (#13) feed. */
  clusterEvents: ClusterEvent[]
  /** GitOps events for the Ops Console's "Deploys" feed category (#13). See `CiNotice` above for
   * why this is empty until GitOps is wired into `tick` (#14/#16). */
  gitopsEvents: GitOpsEvent[]
  /** CI notices for the Ops Console's "Checks" feed category (#13). See `CiNotice` above. */
  ciNotices: CiNotice[]
  /** status.inkwell.example's incident feed. See `StatusUpdate` and #31. */
  statusPage: StatusPageState
  gitops: GitOpsState
  ci: CiState
  telemetry: TelemetryState
  testlab: TestLabState
  incident: IncidentState
}

/**
 * What the learner (or a scheduled effect, or the store's clock) makes happen. This union is
 * open: as each remaining sub-engine lands (gitops #7, ci #8, telemetry #9, testlab #30, incident
 * #31) it adds its own action variants here (e.g. `syncApp`, `dropTestStep`, `ackPage`), and
 * `reduce` grows a case that routes to that engine's own reduce function. The cluster engine (#6)
 * was wired in first, in #4: `tick` and the `chooseWish`/`unplugCopy`/`setBox`/`crashCopy` wishes
 * the Ops Console (#13) will dispatch.
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
  /** Ask Kai: post the question and Kai's `MentorEntry` answer to `config.mentor`'s DM. A
   * `questionId` `config.mentor` doesn't have an entry for is a no-op besides the event, so a
   * missing/removed FAQ entry never crashes the reducer. */
  | { type: 'askMentor'; questionId: string }
  | { type: 'applyEffect'; effect: Effect }
  | { type: 'showHint' }
  | { type: 'revealSolution' }
  | { type: 'dismissToast' }
  | { type: 'restartChapter' }
  | { type: 'startChapter'; chapterId: string }
  | { type: 'continueStory' }
  /** An optional step the learner chose not to do. */
  | { type: 'skipStep' }
  /**
   * Advances the fake clock by `deltaMs` and runs one cluster `reconcile` pass. Dispatched by the
   * store on a real interval (see `store/gameStore.ts`); never dispatched by the UI directly.
   */
  | { type: 'tick'; deltaMs: number }
  /** The Ops Console "Make it so": ask the cluster to run `copies` of `app`@`version`. */
  | { type: 'chooseWish'; app: string; version: string; copies: number }
  /** The Ops Console "pretend it crashed": unplug a copy outright, no graceful stop. */
  | { type: 'unplugCopy'; copyId: string }
  /** The Ops Console "turn off box B": flips a box on or off. */
  | { type: 'setBox'; boxId: string; on: boolean }
  /** A scripted scenario crashes a copy in place; `reconcile` restarts it. */
  | { type: 'crashCopy'; copyId: string }
  /**
   * Posts an update to status.inkwell.example. This is the incident engine's (#31) interface onto
   * the status page; #17 dispatches it only in tests, to render the feed against fixture data.
   */
  | {
      type: 'postStatusUpdate'
      component: StatusComponentId
      state: StatusComponentState
      message: string
    }

export interface ReduceResult {
  state: GameState
  /** Effects with a delay, for the store to schedule. Everything else is already applied. */
  effects: Effect[]
}

/** Fake seconds that pass per action, so messages get plausible, increasing timestamps. */
const TICK = 20

/**
 * A cluster with nothing on it: no boxes, no wishes. Real content isn't wired up until #10, so
 * every chapter's `setup` builds its own starting cluster (boxes, database, wishes) from there;
 * this is only what a brand-new game (or a mid-jump reset) needs to be valid in the meantime.
 */
function blankCluster(): ClusterState {
  return createCluster({
    boxes: [],
    database: { version: '1.0', health: 'Healthy' },
    config: { startupMs: 3000, stopMs: 2000, versionBehaviour: {} },
  })
}

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
      dynamicChannels: [],
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
    cluster: blankCluster(),
    clusterEvents: [],
    gitopsEvents: [],
    ciNotices: [],
    statusPage: { updates: [] },
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

/**
 * The one clock to rule them all: advances `clock.now` by `deltaMs` (real time, scaled by the
 * store for `?fast=1`, and not advanced at all while the store is paused — see
 * `store/gameStore.ts`) and runs one cluster `reconcile` pass at the new time. Every other engine
 * that grows its own clock-driven loop (gitops' sync poll, telemetry's alert evaluation, …) will
 * get its pass added here too.
 */
function tick(config: GameConfig, previous: GameState, deltaMs: number): ReduceResult {
  const now = previous.clock.now + deltaMs
  const { cluster, events } = reconcile(previous.cluster, now)
  const state: GameState = {
    ...previous,
    clock: { now },
    cluster,
    // Kept in full while playing (it's a scrollback feed); the store trims it for storage.
    clusterEvents: [...previous.clusterEvents, ...events],
  }
  return advanceStory(
    config,
    state,
    events.map((event) => ({ type: 'clusterEvent', event }))
  )
}

export function reduce(config: GameConfig, previous: GameState, action: Action): ReduceResult {
  if (action.type === 'tick') return tick(config, previous, action.deltaMs)

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

    case 'openChannel':
      return advanceStory(config, openChannelState(state, action.channel), [
        { type: 'channelOpened', channel: action.channel },
      ])

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

    case 'askMentor': {
      const mentor = config.mentor
      const entry = mentor?.entries[action.questionId]
      if (!mentor || !entry) {
        return advanceStory(config, state, [
          { type: 'mentorQuestionAsked', questionId: action.questionId },
        ])
      }
      // The docs link is appended here, not stored on the entry, so `MentorEntry.answer` alone is
      // what the content style guide's 120-word cap measures (see `MentorEntry`).
      const asked = applyEffect(config, state, {
        type: 'flackMessage',
        channel: mentor.channel,
        from: 'player',
        text: entry.question,
      })
      const answered = applyEffect(config, asked.state, {
        type: 'flackMessage',
        channel: mentor.channel,
        from: mentor.characterId,
        text: `${entry.answer}\n\nMore: [${entry.docs.label}](${entry.docs.href})`,
      })
      return advanceStory(config, answered.state, [
        ...asked.events,
        ...answered.events,
        { type: 'mentorQuestionAsked', questionId: action.questionId },
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

    case 'chooseWish': {
      const cluster = setClusterWish(
        state.cluster,
        { app: action.app, version: action.version, copies: action.copies },
        state.clock.now
      )
      return advanceStory(config, { ...state, cluster }, [
        { type: 'wishChosen', app: action.app, version: action.version, copies: action.copies },
      ])
    }

    case 'unplugCopy': {
      const cluster = unplugClusterCopy(state.cluster, action.copyId)
      return advanceStory(config, { ...state, cluster }, [
        { type: 'copyUnplugged', copyId: action.copyId },
      ])
    }

    case 'setBox': {
      const cluster = setClusterBox(state.cluster, action.boxId, action.on)
      return advanceStory(config, { ...state, cluster }, [
        { type: 'boxToggled', boxId: action.boxId, on: action.on },
      ])
    }

    case 'crashCopy': {
      const cluster = crashClusterCopy(state.cluster, action.copyId, state.clock.now)
      return advanceStory(config, { ...state, cluster }, [
        { type: 'copyCrashed', copyId: action.copyId },
      ])
    }

    case 'postStatusUpdate': {
      const update: StatusUpdate = {
        id: `status-${state.statusPage.updates.length + 1}`,
        at: state.clock.now,
        component: action.component,
        state: action.state,
        message: action.message,
      }
      const statusPage: StatusPageState = { updates: [...state.statusPage.updates, update] }
      return advanceStory(config, { ...state, statusPage }, [
        { type: 'statusUpdatePosted', update },
      ])
    }
  }
}
