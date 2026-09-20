import {
  crashCopy as crashClusterCopy,
  createCluster,
  setBox as setClusterBox,
  setWish as setClusterWish,
  unplugCopy as unplugClusterCopy,
  type ClusterEvent,
  type ClusterState,
} from './cluster'
import {
  createCiState,
  pipelineForPR,
  prCheckStatus,
  runJob as runCiJob,
  schedulePipeline,
  skipTest as skipCiTest,
  startJob as startCiJob,
  type CiState,
  type Pipeline,
} from './ci'
import type { GameEvent, Tab } from './events'
import {
  amendPRChange,
  approvePR as approveGitOpsPR,
  createGitOps,
  findPullRequest,
  GITOPS_EVENT_KINDS,
  mergePR as mergeGitOpsPR,
  openPR as openGitOpsPR,
  revertPR as revertGitOpsPR,
  rollback as rollbackGitOps,
  setPRChecks,
  sync as syncGitOps,
  tick as gitopsTick,
  type GitOpsEvent,
  type GitOpsNotice,
  type GitOpsState,
  type PullRequest,
  type PullRequestChange,
} from './gitops'
import { applyEffect, openChannelState } from './story/effects'
import { advanceStory, enterStep, skipStep } from './story/runner'
import type { BotCard, Channel, Effect, GameConfig, KaiResponse, QuickReply } from './story/types'

// Bumped for #17: GameState grew a `statusPage` slot. No migration is worth writing this early —
// an old save just gets discarded (see `store/persistence.ts` → `migrate`) and the game restarts.
export const GAME_STATE_VERSION = 2

/**
 * Placeholder engine state slots.
 *
 * `telemetry`, `testlab` and `incident` are being built in parallel (tickets #9, #30, #31). Until
 * each lands, its slot on `GameState` is this empty shape. Swapping a slot for the real thing is a
 * one-line change in this file: replace the `type X = Record<string, never>` below with
 * `import type { XState as X } from './x'`, and give `blankState` its real initial value.
 * `cluster` (#6) was the first to be wired in, in #4, since the reconcile loop runs on the clock
 * the store owns; `gitops` (#7) and `ci` (#8) followed in #11, so the "Where is my change?" strip
 * has real state to read (see `src/features/instructions/whereIsMyChange.ts`). `gitops` grew its
 * clock-driven tick in #53 (below), since Argh CD's auto-sync and self-heal timers run on it
 * whether or not a chapter has ever opened a pull request yet. `ci` grew its `reduce` cases in
 * #15 (`openPR` schedules a pipeline; `runJob` advances it).
 */
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
 * instead, and (unlike the cluster and gitops engines) none of its state transitions are
 * clock-driven: `schedulePipeline` resolves Build and Unit tests synchronously the moment a PR's
 * pipeline is scheduled, and the end-to-end job only ever moves because the learner clicks "Run"
 * (`runJob`), never because time passed (see #53's PR description). GitNub's actions (#15) push
 * entries here as jobs run, the same way `tick` below pushes `clusterEvents`/`gitopsEvents`.
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
    /** Argh CD's copy drawer shows "Unplug this copy" once this is true. See `unlockUnplugCopy`. */
    canUnplugCopies: boolean
  }
  story: StoryState
  cluster: ClusterState
  /** Cluster events from `reconcile`, oldest first, for the Ops Console (#13) feed. */
  clusterEvents: ClusterEvent[]
  /** GitOps events for the Ops Console's "Deploys" feed category (#13): auto-sync and self-heal,
   * pushed by `tick` (#53). */
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
   * Advances the fake clock by `deltaMs` and runs the gitops engine's `tick` (cluster `reconcile`,
   * plus Argh CD's auto-sync/self-heal timers, #53). Dispatched by the store on a real interval
   * (see `store/gameStore.ts`); never dispatched by the UI directly.
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
  /** GitNub (#15): open a PR against a repo. Schedules a CI pipeline and, for a wish change,
   * auto-runs the end-to-end job so Ch 4 doesn't need the ▶ click. */
  | {
      type: 'openPR'
      repo: string
      title: string
      change: PullRequestChange
      reviewers?: string[]
      author?: string
    }
  | { type: 'approvePR'; prId: string; reviewer: string }
  | { type: 'mergePR'; prId: string }
  | { type: 'runJob'; pipelineId: string; jobId: string }
  | { type: 'startJob'; pipelineId: string; jobId: string }
  | { type: 'revertPR'; prId: string }
  /** Ch 5 / Ch 10: pick a suggested fix on a failing PR. `skip-test` marks a test skipped;
   * `fix-code` clears the version's behaviour flags and reschedules checks. */
  | { type: 'suggestFix'; prId: string; fix: 'skip-test' | 'fix-code'; testName?: string }
  /** Argh CD (#16): apply GitNub's wish now, instead of waiting for auto-sync. */
  | { type: 'sync'; app: string }
  /** Argh CD (#16): re-apply a history entry to the cluster. GitNub is unchanged, so auto-sync
   * will bounce it back — see `rollback` in `engine/gitops/sync.ts`. */
  | { type: 'rollback'; app: string; historyId: string }

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

/** A GitOps world with no commits and no pull requests yet. Real content (#15+) seeds its own. */
function blankGitOps(): GitOpsState {
  return createGitOps({ config: { autoSyncDelayMs: 4000, selfHealDelayMs: 6000 } })
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
    ui: { activeTab: 'flack', unlockedTabs: ['flack'], canUnplugCopies: false },
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
    gitops: blankGitOps(),
    ci: createCiState(),
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
 * `gitops`'s `tick` (`engine/gitops/sync.ts`) mixes the cluster's own reconcile events into its one
 * combined `events` array, so Argh CD's feed and the cluster's read as one stream. `GameState`
 * keeps them in separate arrays for the Ops Console's feed categories (#13), so this splits that
 * array back apart by checking each event's `kind` against gitops's own list of kinds.
 */
function isGitOpsEvent(event: ClusterEvent | GitOpsEvent): event is GitOpsEvent {
  return (GITOPS_EVENT_KINDS as readonly string[]).includes(event.kind)
}

/**
 * The one clock to rule them all: advances `clock.now` by `deltaMs` (real time, scaled by the
 * store for `?fast=1`, and not advanced at all while the store is paused — see
 * `store/gameStore.ts`) and runs the gitops engine's `tick` at the new time, which runs the
 * cluster's own `reconcile` pass *and* Argh CD's auto-sync/self-heal timers (#53; see planning.md →
 * "GitOps" and "One clock to rule them all"). Every `GitOpsNotice` it returns is raised as a
 * `gitOpsNotice` effect, which `story/effects.ts` (#12) turns into a `#deploys` Flack message from
 * the Argh CD bot. Every other engine that grows its own clock-driven loop (telemetry's alert
 * evaluation, …) will get its pass added here too.
 */
function tick(config: GameConfig, previous: GameState, deltaMs: number): ReduceResult {
  const now = previous.clock.now + deltaMs
  const { gitops, cluster, events, notices } = gitopsTick(previous.gitops, previous.cluster, now)
  const clusterEvents = events.filter((event): event is ClusterEvent => !isGitOpsEvent(event))
  const gitopsEvents = events.filter(isGitOpsEvent)
  const state: GameState = {
    ...previous,
    clock: { now },
    cluster,
    gitops,
    // Kept in full while playing (they're scrollback feeds); the store trims them for storage.
    clusterEvents: [...previous.clusterEvents, ...clusterEvents],
    gitopsEvents: [...previous.gitopsEvents, ...gitopsEvents],
  }
  return advanceStory(
    config,
    state,
    [
      ...clusterEvents.map((event) => ({ type: 'clusterEvent' as const, event })),
      ...gitopsEvents.map((event) => ({ type: 'gitOpsEvent' as const, event })),
    ],
    notices.map((notice) => ({ type: 'gitOpsNotice' as const, notice }))
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

    case 'setPlayerName': {
      const name = action.name.trim().slice(0, 40)
      if (!name) return { state: previous, effects: [] }
      return advanceStory(config, state, [{ type: 'playerNamed', name }])
    }

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
      const copyId = resolveCopyId(state, action.copyId)
      if (!copyId) return { state: previous, effects: [] }
      const cluster = unplugClusterCopy(state.cluster, copyId)
      return advanceStory(config, { ...state, cluster }, [{ type: 'copyUnplugged', copyId }])
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

    case 'openPR':
      return openPullRequest(config, state, action)

    case 'approvePR': {
      const prId = resolvePrId(state, action.prId)
      if (!prId) return { state: previous, effects: [] }
      const gitops = approveGitOpsPR(state.gitops, prId, action.reviewer)
      return advanceStory(config, { ...state, gitops }, [
        { type: 'prApproved', prId, reviewer: action.reviewer },
      ])
    }

    case 'mergePR': {
      const prId = resolvePrId(state, action.prId)
      if (!prId) return { state: previous, effects: [] }
      try {
        const { gitops, pullRequest } = mergeGitOpsPR(state.gitops, prId, state.clock.now)
        return advanceStory(config, { ...state, gitops }, [
          { type: 'prMerged', prId: pullRequest.id },
        ])
      } catch {
        return { state: previous, effects: [] }
      }
    }

    case 'startJob': {
      const ci = startCiJob(state.ci, action.pipelineId, action.jobId)
      const next = pushCiNotice(
        { ...state, ci },
        `Job ${action.jobId} running`,
        'End-to-end tests are running.'
      )
      return advanceStory(config, next, [
        { type: 'jobStarted', pipelineId: action.pipelineId, jobId: action.jobId },
      ])
    }

    case 'runJob': {
      const resolved = resolveJob(state, action.pipelineId, action.jobId)
      if (!resolved) return { state: previous, effects: [] }
      return runPipelineJob(config, state, resolved.pipelineId, resolved.jobId)
    }

    case 'revertPR': {
      try {
        const { gitops, pullRequest } = revertGitOpsPR(state.gitops, action.prId, state.clock.now)
        return advanceStory(config, { ...state, gitops }, [
          { type: 'prReverted', prId: action.prId, revertPrId: pullRequest.id },
        ])
      } catch {
        return { state: previous, effects: [] }
      }
    }

    case 'suggestFix':
      return suggestFix(config, state, action)

    case 'sync':
      return applyArghAction(
        config,
        state,
        () => syncGitOps(state.gitops, state.cluster, action.app, state.clock.now),
        { type: 'appSynced', app: action.app }
      )

    case 'rollback':
      return applyArghAction(
        config,
        state,
        () =>
          rollbackGitOps(
            state.gitops,
            state.cluster,
            action.app,
            action.historyId,
            state.clock.now
          ),
        { type: 'appRolledBack', app: action.app, historyId: action.historyId }
      )
  }
}

const BUILD_MS = 800
const UNIT_MS = 1200
const AUTO_APPROVE_DELAY_MS = 4000

/** Chapters can't know a copy's generated id. `any:search` means "the first running copy of search". */
function resolveCopyId(state: GameState, copyId: string): string | undefined {
  if (!copyId.startsWith('any:')) return copyId
  const app = copyId.slice(4)
  return state.cluster.copies.find((copy) => copy.app === app && copy.state === 'Running')?.id
}

/** Chapters can't know a generated PR id. `latest` means the most recently opened pull request. */
function resolvePrId(state: GameState, prId: string): string | undefined {
  if (prId !== 'latest') return prId
  return state.gitops.pullRequests.at(-1)?.id
}

/** `pipelineId: 'latest'` and `jobId: 'e2e'` let chapter solutions name a job without generated ids. */
function resolveJob(
  state: GameState,
  pipelineId: string,
  jobId: string
): { pipelineId: string; jobId: string } | undefined {
  const pipeline =
    pipelineId === 'latest'
      ? Object.values(state.ci.pipelines).at(-1)
      : state.ci.pipelines[pipelineId]
  if (!pipeline) return undefined
  const job =
    jobId === 'e2e'
      ? pipeline.stages.find((stage) => stage.name === 'End-to-end tests')?.jobs[0]
      : pipeline.stages.flatMap((stage) => stage.jobs).find((candidate) => candidate.id === jobId)
  if (!job) return undefined
  return { pipelineId: pipeline.id, jobId: job.id }
}

function pushCiNotice(state: GameState, raw: string, english: string): GameState {
  return {
    ...state,
    ciNotices: [...state.ciNotices, { at: state.clock.now, raw, english }],
  }
}

function e2eJob(pipeline: Pipeline) {
  return pipeline.stages.find((stage) => stage.name === 'End-to-end tests')?.jobs[0]
}

function behaviourFor(state: GameState, app: string, version: string): Record<string, unknown> {
  return state.cluster.config.versionBehaviour[`${app}@${version}`] ?? {}
}

function versionOf(change: PullRequestChange): string {
  return change.kind === 'wish' ? change.wish.version : change.version.version
}

function attachPipeline(
  config: GameConfig,
  state: GameState,
  pr: PullRequest,
  autoRunE2e: boolean
): { state: GameState; pipeline: Pipeline } {
  const app = pr.change.app
  const version = versionOf(pr.change)
  const behaviour =
    pr.change.kind === 'version' ? pr.change.version.behaviour : behaviourFor(state, app, version)
  const scheduled = schedulePipeline(
    state.ci,
    {
      prId: pr.id,
      service: app,
      suite: config.testSuites?.[app] ?? [],
      behaviour,
      buildDurationMs: BUILD_MS,
      unitTestDurationMs: UNIT_MS,
    },
    state.clock.now
  )
  let ci = scheduled.ci
  let pipeline = scheduled.pipeline
  if (autoRunE2e) {
    const job = e2eJob(pipeline)
    if (job) {
      ci = runCiJob(ci, pipeline.id, job.id)
      pipeline = ci.pipelines[pipeline.id]!
    }
  }
  const gitops = setPRChecks(state.gitops, pr.id, prCheckStatus(pipeline), pipeline.id)
  const withNotice = pushCiNotice(
    { ...state, ci, gitops },
    `Pipeline ${pipeline.id} scheduled for ${pr.id}`,
    `Checks started for ${pr.title}.`
  )
  return { state: withNotice, pipeline }
}

function delayedApprovals(pr: PullRequest): Effect[] {
  return (pr.reviewers ?? []).map((reviewer) => ({
    type: 'approvePR' as const,
    prId: pr.id,
    reviewer,
    delayMs: AUTO_APPROVE_DELAY_MS,
  }))
}

function openPullRequest(
  config: GameConfig,
  state: GameState,
  action: Extract<Action, { type: 'openPR' }>
): ReduceResult {
  const opened = openGitOpsPR(
    state.gitops,
    {
      repo: action.repo,
      title: action.title,
      author: action.author ?? 'player',
      change: action.change,
      reviewers: action.reviewers,
    },
    state.clock.now
  )
  const autoRunE2e = action.change.kind === 'wish'
  const attached = attachPipeline(
    config,
    { ...state, gitops: opened.gitops },
    opened.pullRequest,
    autoRunE2e
  )
  const pr = findPullRequest(attached.state.gitops, opened.pullRequest.id)!
  const pipeline = attached.pipeline
  const effects = prCheckStatus(pipeline) === 'open' ? delayedApprovals(pr) : []
  return advanceStory(config, attached.state, [{ type: 'prOpened', prId: pr.id }], effects)
}

function runPipelineJob(
  config: GameConfig,
  state: GameState,
  pipelineId: string,
  jobId: string
): ReduceResult {
  const ci = runCiJob(state.ci, pipelineId, jobId)
  const pipeline = ci.pipelines[pipelineId]
  if (!pipeline) return { state, effects: [] }
  const gitops = pipeline.prId
    ? setPRChecks(state.gitops, pipeline.prId, prCheckStatus(pipeline), pipeline.id)
    : state.gitops
  const job = pipeline.stages
    .flatMap((stage) => stage.jobs)
    .find((candidate) => candidate.id === jobId)
  const english =
    job?.status === 'failed'
      ? 'End-to-end tests failed. This change cannot be merged yet.'
      : job?.status === 'skipped'
        ? 'End-to-end tests finished with a skipped check.'
        : 'End-to-end tests passed.'
  const next = pushCiNotice(
    { ...state, ci, gitops },
    `Job ${jobId} ${job?.status ?? 'ran'}`,
    english
  )
  const pr = pipeline.prId ? findPullRequest(gitops, pipeline.prId) : undefined
  const effects =
    pr && prCheckStatus(pipeline) === 'open' && pr.status === 'open' ? delayedApprovals(pr) : []
  return advanceStory(config, next, [{ type: 'jobRan', pipelineId, jobId }], effects)
}

function suggestFix(
  config: GameConfig,
  state: GameState,
  action: Extract<Action, { type: 'suggestFix' }>
): ReduceResult {
  const prId = resolvePrId(state, action.prId)
  if (!prId) return { state, effects: [] }
  const pr = findPullRequest(state.gitops, prId)
  if (!pr) return { state, effects: [] }
  const pipeline = pipelineForPR(state.ci, pr.id)

  if (action.fix === 'skip-test') {
    if (!pipeline || !action.testName) return { state, effects: [] }
    const ci = skipCiTest(state.ci, pipeline.id, action.testName)
    return advanceStory(config, { ...state, ci }, [
      { type: 'fixSuggested', prId: pr.id, fix: 'skip-test' },
    ])
  }

  // fix-code: drop the behaviour flags that made the tests fail, keep the same version, and
  // start checks over so the learner re-runs e2e against the fix.
  if (pr.change.kind !== 'version') return { state, effects: [] }
  const gitops = amendPRChange(state.gitops, pr.id, {
    ...pr.change,
    version: { ...pr.change.version, behaviour: {} },
  })
  const amended = findPullRequest(gitops, pr.id)!
  const attached = attachPipeline(config, { ...state, gitops }, amended, false)
  return advanceStory(config, attached.state, [
    { type: 'fixSuggested', prId: pr.id, fix: 'fix-code' },
  ])
}

function applyArghAction(
  config: GameConfig,
  state: GameState,
  run: () => {
    gitops: GitOpsState
    cluster: ClusterState
    events: GitOpsEvent[]
    notices: GitOpsNotice[]
  },
  event: Extract<GameEvent, { type: 'appSynced' | 'appRolledBack' }>
): ReduceResult {
  try {
    const result = run()
    const next: GameState = {
      ...state,
      gitops: result.gitops,
      cluster: result.cluster,
      gitopsEvents: [...state.gitopsEvents, ...result.events],
    }
    return advanceStory(
      config,
      next,
      [event],
      result.notices.map((notice) => ({ type: 'gitOpsNotice' as const, notice }))
    )
  } catch {
    return { state, effects: [] }
  }
}
