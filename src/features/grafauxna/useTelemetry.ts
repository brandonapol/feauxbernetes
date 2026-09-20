import { createTelemetry, type Scenario } from '../../engine/telemetry'
import { versionAt, versionBehaviour } from '../../engine/cluster'
import { useGame } from '../../store'

const SEED = 6
const EMPTY_SCENARIO: Scenario = { id: 'live', events: [] }

export function useTelemetry() {
  const cluster = useGame((s) => s.game.cluster)
  return createTelemetry(SEED, EMPTY_SCENARIO, {
    versionAt: (app, t) => versionAt(cluster, app, t),
    behaviour: (app, version) => versionBehaviour(cluster.config, app, version),
  })
}
