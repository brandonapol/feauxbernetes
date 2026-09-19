// Seeded metrics, logs, SLIs, SLOs, error budgets, and alert evaluation. See #9.
import { logs as logsImpl } from './logs'
import { series as seriesImpl } from './series'
import type { LogLevel, LogLine, Scenario, Signal, SeriesPoint, VersionLookup } from './types'

export * from './types'
export { attainment, errorBudget, burnRate } from './slo'
export { replay } from './alerts'
export {
  humanDuration,
  humanCount,
  describeAllowedFailures,
  describeAllowedOutage,
  describeBurnRate,
} from './humanUnits'
export { backgroundErrorBlips, ERROR_BLIP_PROBABILITY } from './series'
export { series } from './series'
export { logs } from './logs'

/**
 * Binds a seed, a scenario and a cluster's version history into the short call shapes the ticket
 * asks for: `telemetry.series(service, signal, from, to, step)` and
 * `telemetry.logs(service, level?, query?, from, to)`. Everything is still a pure function of
 * `(seed, scenario, versions, t)` underneath — this is just a convenience so callers don't have to
 * thread the first three arguments through every call.
 *
 * `versions` is the entire coupling to the cluster engine, and it's just two functions — in
 * production, `{ versionAt: (app, t) => versionAt(cluster, app, t), behaviour: (app, version) =>
 * versionBehaviour(config, app, version) }` — so this package never imports `src/engine/cluster`
 * and stays trivial to test with fakes.
 */
export function createTelemetry(seed: number, scenario: Scenario, versions: VersionLookup) {
  return {
    series(service: string, signal: Signal, from: number, to: number, step: number): SeriesPoint[] {
      return seriesImpl(seed, scenario, versions, service, signal, from, to, step)
    },
    logs(
      service: string,
      level: LogLevel | undefined,
      query: string | undefined,
      from: number,
      to: number
    ): LogLine[] {
      return logsImpl(seed, scenario, service, level, query, from, to)
    },
  }
}
