import { createCluster } from '../../cluster'
import type { Box, ClusterSpec, Database, Wish } from '../../cluster'
import { createGitOps } from '../gitops'
import type { GitOpsConfig, GitOpsSpec } from '../types'

/** Two boxes with room for three copies each, matching the cluster engine's own fixture. */
export function boxes(): Box[] {
  return [
    { id: 'box-1', name: 'Box 1', capacity: 3, on: true },
    { id: 'box-2', name: 'Box 2', capacity: 3, on: true },
  ]
}

export const DATABASE: Database = { version: '9.1', health: 'Healthy' }

/** Round-number delays, easy to reason about in tests: 100ms to sync, 200ms to self-heal. */
export function gitOpsConfig(overrides: Partial<GitOpsConfig> = {}): GitOpsConfig {
  return { autoSyncDelayMs: 100, selfHealDelayMs: 200, ...overrides }
}

export function clusterSpec(overrides: Partial<ClusterSpec> = {}): ClusterSpec {
  return {
    boxes: boxes(),
    database: DATABASE,
    config: { startupMs: 25, stopMs: 25, versionBehaviour: {} },
    ...overrides,
  }
}

/** A cluster already running `search@v1` × 3, matching what the deploy repo below wishes for. */
export function basicCluster(overrides: Partial<ClusterSpec> = {}) {
  return createCluster(
    clusterSpec({ wishes: [{ app: 'search', version: 'v1', copies: 3 }], ...overrides })
  )
}

const SEARCH_WISH: Wish = { app: 'search', version: 'v1', copies: 3 }

/** A deploy repo already committed to `search@v1` × 3 — the same wish `basicCluster` starts with. */
export function basicGitOps(spec: Partial<GitOpsSpec> = {}) {
  return createGitOps({
    config: gitOpsConfig(),
    wishes: [SEARCH_WISH],
    ...spec,
  })
}

export { SEARCH_WISH }
