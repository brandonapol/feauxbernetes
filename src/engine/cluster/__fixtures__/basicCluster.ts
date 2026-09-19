import { createCluster } from '../cluster'
import type { Box, ClusterConfig, ClusterSpec, Database } from '../types'

/** Two boxes with room for three copies each — enough for the fixtures below without crowding. */
export function boxes(): Box[] {
  return [
    { id: 'box-1', name: 'Box 1', capacity: 3, on: true },
    { id: 'box-2', name: 'Box 2', capacity: 3, on: true },
  ]
}

export const DATABASE: Database = { version: '9.1', health: 'Healthy' }

/** Round-number durations, easy to reason about in tests: 100ms to start, 50ms to stop. */
export function config(overrides: Partial<ClusterConfig> = {}): ClusterConfig {
  return {
    startupMs: 100,
    stopMs: 50,
    versionBehaviour: { 'billing@2.4.1': { couponDoubleDiscount: true } },
    ...overrides,
  }
}

/** A cluster with one app (`search`) wished at 3 copies of `v1`, and nothing running yet. */
export function basicCluster(spec: Partial<ClusterSpec> = {}) {
  return createCluster({
    boxes: boxes(),
    database: DATABASE,
    config: config(),
    wishes: [{ app: 'search', version: 'v1', copies: 3 }],
    ...spec,
  })
}
