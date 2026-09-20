import type { ClusterEvent } from './cluster'
import type { GitOpsEvent } from './gitops'
import type { StatusUpdate } from './game'

/** The fake browser's tabs. Locked ones can't be switched to (see `story/effects.ts`). */
export type Tab = 'flack' | 'gitnub' | 'arghcd' | 'grafauxna' | 'pagerdoody' | 'inkwell'

/**
 * Things that happened, which story steps check their goals against. Goals receive the state
 * *after* the event, so most goals look at the event type and then inspect state.
 *
 * This union is open the same way `Action` and `Effect` are: each sub-engine (cluster #6, gitops
 * #7, ci #8, telemetry #9, testlab #30, incident #31) adds its own events here as it lands (a copy
 * starting, a sync finishing, an alert firing) alongside the ones every chapter needs.
 */
export type GameEvent =
  /** Fired when a step becomes current, so goals already satisfied by state complete at once. */
  | { type: 'stepEntered'; stepId: string }
  /** Every multiple-choice question resolves to this, right or wrong. */
  | { type: 'optionChosen'; stepId: string; optionId: string }
  | { type: 'tabOpened'; tab: Tab }
  /** "Show me" and guided-tour goals: the learner clicked the highlighted element. */
  | { type: 'targetClicked'; targetId: string }
  | { type: 'overlayOpened'; overlay: string }
  | { type: 'overlayClosed' }
  | { type: 'channelOpened'; channel: string }
  /** A new Flack channel appeared, e.g. the `#inc-<n>-<slug>` channel `declareIncident` (#31)
   * creates. */
  | { type: 'channelCreated'; channelId: string }
  | { type: 'flackReply'; messageId: string; replyId: string }
  | { type: 'flackMessage'; messageId: string; channel: string; from: string }
  /** The learner asked Kai one of Ask Kai's FAQ questions. */
  | { type: 'mentorQuestionAsked'; questionId: string }
  /** The one thing besides search the learner ever types: their name. */
  | { type: 'playerNamed'; name: string }
  /** The learner picked a wish from the Ops Console (see cluster #6). */
  | { type: 'wishChosen'; app: string; version: string; copies: number }
  /** The learner unplugged a copy from the Ops Console, pretending it crashed. */
  | { type: 'copyUnplugged'; copyId: string }
  /** The learner turned a box on or off from the Ops Console. */
  | { type: 'boxToggled'; boxId: string; on: boolean }
  /** The learner crashed a copy for a scripted scenario. */
  | { type: 'copyCrashed'; copyId: string }
  /** One raw event out of a `tick`'s reconcile pass. Steps can gate on `event.event.kind`. */
  | { type: 'clusterEvent'; event: ClusterEvent }
  /** One raw event out of a `tick`'s Argh CD pass (auto-sync, self-heal, …). Steps can gate on
   * `event.event.kind`. See #53. */
  | { type: 'gitOpsEvent'; event: GitOpsEvent }
  /** A status.inkwell.example update was posted (see `postStatusUpdate`, #17 and #31). */
  | { type: 'statusUpdatePosted'; update: StatusUpdate }
