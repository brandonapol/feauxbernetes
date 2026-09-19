/**
 * The numbers behind Grafauxna: golden-signal time series, logs, SLOs and alerting. See
 * planning.md → "Telemetry". Everything here is pure and seeded — no `Math.random`, no
 * `Date.now`, no wall-clock time. Fake-clock milliseconds (`t`) are the only notion of time.
 */

/** The four golden signals, plus split latency percentiles. */
export type Signal = 'latencyP50' | 'latencyP95' | 'traffic' | 'errorRate' | 'saturation'

/** One sample. `value` is in the signal's natural unit: ms for latency, req/min for traffic,
 * percent (0-100) for errorRate and saturation. */
export interface SeriesPoint {
  t: number
  value: number
}

export type ScenarioEventKind = 'errorSpike' | 'trafficSpike' | 'latencySpike' | 'saturationSpike'

/**
 * A scenario event layers a bump on top of the seeded baseline for one service and signal,
 * starting at `at` and lasting up to `durationMs` (a step function — real incidents don't fade
 * in gently, and neither do these). If `behaviourFlag` is set, the bump is only in effect while
 * the version running for `app` (via `VersionLookup.behaviour`) has that flag truthy — so a
 * rollback that clears the flag ends the event's effect immediately, even before `durationMs` is
 * up. That's the whole "rolling back shortens the spike" mechanic.
 */
export interface ScenarioEvent {
  at: number
  /** Which service's series this event affects. */
  service: string
  kind: ScenarioEventKind
  /** How much the signal is bumped, at full strength, added to its baseline in its own unit:
   * percentage points for errorRate/saturation, added ms for latency, added req/min for traffic. */
  magnitude: number
  /** How long the event lasts if nothing ends it early (no rollback, no natural resolution). */
  durationMs: number
  /** Gate: the app whose running version decides whether this event is currently "real."
   * Defaults to `service` — pass a different app id for a scenario where the deploy that causes
   * a service's symptom is a different app (rare, but the hook is there). */
  app?: string
  /** Only in effect while `behaviour(app, versionAt(app, t))[behaviourFlag]` is truthy. Omit for
   * an event that isn't tied to a specific version at all (e.g. a scheduled traffic spike). */
  behaviourFlag?: string
  /** A log line emitted once, at `at`, explaining the event in the Logs panel. */
  logEnglish?: string
}

export interface Scenario {
  id: string
  events: ScenarioEvent[]
}

/**
 * The narrow slice of the cluster engine telemetry needs, so this package stays standalone and
 * testable with fakes instead of importing `src/engine/cluster` directly. In production these are
 * `(app, t) => versionAt(cluster, app, t)` and `(app, version) => versionBehaviour(config, app,
 * version)`.
 */
export interface VersionLookup {
  versionAt: (app: string, t: number) => string | undefined
  behaviour: (app: string, version: string) => Record<string, unknown>
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogLine {
  at: number
  service: string
  level: LogLevel
  english: string
  raw: string
}

/** An SLO as data. `sli` is a human-readable label for what counts as good/valid — the actual
 * counts are supplied by callers of `attainment` / `errorBudget`, not stored here. */
export interface Slo {
  id: string
  service: string
  sli: { good: string; valid: string }
  /** e.g. 0.999 for "99.9%". */
  target: number
  windowDays: number
}

export interface ErrorBudget {
  allowedEvents: number
  spentEvents: number
  remainingEvents: number
  allowedMinutes: number
  spentMinutes: number
  remainingMinutes: number
}

export type AlertExpr =
  | 'anyError'
  | { threshold: number; forMinutes: number }
  | { burnRate: number; longWindowMinutes: number; shortWindowMinutes: number; target: number }

export interface AlertRule {
  id: string
  name: string
  expr: AlertExpr
  severity: 'page' | 'ticket'
}

/** One page or ticket, at the moment the rule's condition first became true (the rising edge —
 * real on-call doesn't get re-paged every minute an outage continues). */
export interface Firing {
  ruleId: string
  ruleName: string
  severity: 'page' | 'ticket'
  at: number
}
