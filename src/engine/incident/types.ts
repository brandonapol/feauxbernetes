import type { Scenario } from '../telemetry/types'

/**
 * The incident engine's state and content shapes (#31). See planning.md → "Incident".
 *
 * Every time here is a fake-clock value (`GameState.clock.now`), in the same units the store's
 * `tick` advances it by (milliseconds of game time). Nothing reads the wall clock.
 */

export type Severity = 'SEV1' | 'SEV2' | 'SEV3'

/** The four stages a status page update can announce, in the order an incident moves through them. */
export type StatusStage = 'investigating' | 'identified' | 'monitoring' | 'resolved'

export const STATUS_STAGES: readonly StatusStage[] = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
]

/** Everything the timeline recorder records. One entry per meaningful learner (or scripted) step. */
export type TimelineKind =
  | 'paged'
  | 'acked'
  | 'declared'
  | 'hypothesisChecked'
  | 'mitigationChosen'
  | 'rollbackStarted'
  | 'recovered'
  | 'statusPosted'
  | 'resolved'

export interface TimelineEntry {
  /** Fake-clock time it happened. */
  at: number
  kind: TimelineKind
  /** Plain English, ready for the timeline and the postmortem (Ch 10). */
  text: string
}

/** Who does what. Character ids, or `player` for the learner. */
export interface IncidentRoles {
  commander: string
  ops: string
  comms: string
}

export interface Declaration {
  /** The `<n>` in `#inc-<n>-<slug>`. */
  number: number
  slug: string
  channelId: string
  severity: Severity
  roles: IncidentRoles
}

/** The moments the scorecard measures from. `mitigated` is when customers stopped being hurt. */
export interface IncidentMarks {
  paged?: number
  acked?: number
  declared?: number
  mitigated?: number
  resolved?: number
}

export interface Incident {
  /** The app that's hurting, e.g. `billing`. */
  service: string
  phase: 'open' | 'resolved'
  /** When the incident started for us: the page, or the declaration if nobody was paged. */
  startedAt: number
  marks: IncidentMarks
  /** Set once someone declares it. A page alone isn't an incident yet. */
  declaration?: Declaration
  /** Oldest first. */
  timeline: TimelineEntry[]
  impact: {
    /** Customers hurt so far. Fractional while accruing; show `Math.floor`. */
    customers: number
    /** Fake-clock time the counter last sampled telemetry. */
    sampledAt: number
  }
  /** Status page updates posted, oldest first. */
  statusPosts: Array<{ stage: StatusStage; optionId: string }>
}

export interface IncidentState {
  /** How many incidents have been declared this game, for numbering channels. */
  declaredCount: number
  /** The current incident, or the most recent one once it's resolved (Ch 10 reads it). */
  current?: Incident
}

/** What a chapter (as an effect) or a panel (as an action) can make happen to an incident. */
export type IncidentCommand =
  /** PagerDoody pages the learner. Starts a new incident and opens the `page` overlay. */
  | { kind: 'page'; service: string; text: string }
  | { kind: 'ack' }
  | { kind: 'declare'; severity: Severity; service: string; slug?: string }
  | { kind: 'hypothesis'; text: string }
  | { kind: 'mitigation'; text: string }
  | { kind: 'rollbackStarted'; text: string }
  /** Customers stopped being hurt. Also recorded automatically once telemetry agrees after a
   * rollback; see `tickIncident`. */
  | { kind: 'recovered'; text?: string }
  | { kind: 'postStatus'; stage: StatusStage; optionId: string }
  | { kind: 'resolve' }

/**
 * How telemetry turns into a customer impact count for one service: the extra error rate a
 * `scenario` adds on top of the service's ordinary background noise, times its traffic, times the
 * `share` of those failed requests that are a customer being turned away.
 */
export interface ImpactModel {
  seed: number
  scenario: Scenario
  share: number
  /** Plural noun for the counter, e.g. "failed coupon checkouts". */
  label: string
}

/** One pre-written status page update. */
export interface StatusUpdateOption {
  id: string
  message: string
  /** What the component's badge on the status page says once this is posted. */
  componentState: 'operational' | 'degraded' | 'outage'
  /** Why this one is (or isn't) a good update, shown once it's picked. */
  note: string
}

export type ScoreMetric = 'mtta' | 'timeToMitigate' | 'timeToResolve' | 'customersAffected'

/** "A typical team" for one scorecard number, and notes on what moves it. */
export interface TypicalRange {
  label: string
  low: number
  high: number
  /** Shown when the learner's number is under `low`, between the two, or over `high`. */
  notes: { below: string; within: string; above: string }
}

/** Incident content, from `src/content/incident.ts`. The engine never imports content directly. */
export interface IncidentContent {
  roles: IncidentRoles
  /**
   * Posted by the commander in the new channel. Placeholders: `{severity}`, `{service}`,
   * `{commander}`, `{ops}`, `{comms}`. `{{player.name}}` works as in any Flack message.
   */
  declaredMessage: string
  /** The `<slug>` in `#inc-<n>-<slug>`, by service. Defaults to `<service>-incident`. */
  slugs: Record<string, string>
  /** Customer-facing status page component, by service. */
  statusComponents: Record<string, 'website' | 'search' | 'checkout'>
  impact: Record<string, ImpactModel>
  statusUpdates: Record<StatusStage, StatusUpdateOption[]>
  typical: Record<ScoreMetric, TypicalRange>
}
