import { versionAt, versionBehaviour } from '../cluster'
import type { ClusterState } from '../cluster'
import { series } from '../telemetry/series'
import type { Scenario, VersionLookup } from '../telemetry/types'
import type { ImpactModel } from './types'

const QUIET: Scenario = { id: 'quiet', events: [] }
const MS_PER_MINUTE = 60_000

function lookup(cluster: ClusterState): VersionLookup {
  return {
    versionAt: (app, t) => versionAt(cluster, app, t),
    behaviour: (app, version) => versionBehaviour(cluster.config, app, version),
  }
}

/**
 * The error rate (percentage points) `model.scenario` adds to `service` at time `t`, over and above
 * its ordinary background noise. Zero once a rollback takes the bad version out of service, since
 * the scenario's events are gated on that version's behaviour flags (see `telemetry/types.ts`).
 */
export function impactBumpAt(
  model: ImpactModel,
  cluster: ClusterState,
  service: string,
  t: number
): number {
  const versions = lookup(cluster)
  const withIncident = series(model.seed, model.scenario, versions, service, 'errorRate', t, t, 1)
  const baseline = series(model.seed, QUIET, versions, service, 'errorRate', t, t, 1)
  return Math.max(0, withIncident[0].value - baseline[0].value)
}

/** Customers turned away per fake-clock ms at time `t`: extra error rate × traffic × share. */
export function impactRateAt(
  model: ImpactModel,
  cluster: ClusterState,
  service: string,
  t: number
): number {
  const bump = impactBumpAt(model, cluster, service, t)
  if (bump === 0) return 0
  const traffic = series(model.seed, model.scenario, lookup(cluster), service, 'traffic', t, t, 1)
  return (bump / 100) * (traffic[0].value / MS_PER_MINUTE) * model.share
}
