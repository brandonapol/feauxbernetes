import type {
  AppSummary,
  Box,
  ClusterConfig,
  ClusterSpec,
  ClusterState,
  CopyState,
  Wish,
} from './types'

/** Builds a cluster from content: boxes, a starting database, config, and (usually) some wishes. */
export function createCluster(spec: ClusterSpec): ClusterState {
  const wishes: Record<string, Wish> = {}
  const history: ClusterState['history'] = []
  for (const wish of spec.wishes ?? []) {
    wishes[wish.app] = wish
    history.push({ at: 0, app: wish.app, version: wish.version })
  }
  return {
    config: spec.config,
    boxes: spec.boxes.map((box) => ({ ...box })),
    copies: [],
    wishes,
    database: { ...spec.database },
    history,
    nextCopySeq: 0,
  }
}

/** Sets (or changes) what `app` should be running. `reconcile` does the rest. */
export function setWish(cluster: ClusterState, wish: Wish, now: number): ClusterState {
  const previous = cluster.wishes[wish.app]
  const versionChanged = !previous || previous.version !== wish.version
  return {
    ...cluster,
    wishes: { ...cluster.wishes, [wish.app]: wish },
    history: versionChanged
      ? [...cluster.history, { at: now, app: wish.app, version: wish.version }]
      : cluster.history,
  }
}

/**
 * Kills a copy outright, as if someone had unplugged it — no graceful Stopping period. The next
 * `reconcile` notices the shortfall and starts a replacement.
 */
export function unplugCopy(cluster: ClusterState, copyId: string): ClusterState {
  return { ...cluster, copies: cluster.copies.filter((copy) => copy.id !== copyId) }
}

/**
 * Turns a box on or off. Turning one off doesn't touch its copies here — `reconcile` evicts them
 * and reschedules on the next tick, which is what makes the eviction visible as an event.
 */
export function setBox(cluster: ClusterState, id: string, on: boolean): ClusterState {
  return { ...cluster, boxes: cluster.boxes.map((box) => (box.id === id ? { ...box, on } : box)) }
}

/** Crashes a copy for a scripted scenario. `reconcile` restarts it in place on the next tick. */
export function crashCopy(cluster: ClusterState, copyId: string, now: number): ClusterState {
  return {
    ...cluster,
    copies: cluster.copies.map((copy) =>
      copy.id === copyId ? { ...copy, state: 'Crashed' as CopyState, startedAt: now } : copy
    ),
  }
}

/** The "wants 3 · has 2" line used everywhere in the Ops Console. */
export function summary(cluster: ClusterState, app: string): AppSummary {
  const appCopies = cluster.copies.filter((copy) => copy.app === app)
  const count = (state: CopyState) => appCopies.filter((copy) => copy.state === state).length
  return {
    wants: cluster.wishes[app]?.copies ?? 0,
    has: count('Running'),
    starting: count('Starting'),
    stopping: count('Stopping'),
  }
}

/**
 * Which version of `app` was wished for as of fake-clock time `at`. Telemetry uses this to answer
 * "which version of app X was running at time t." A rollout is treated as instantaneous at the
 * moment the wish changed, rather than tracking the mixed old/new fleet while it's in flight —
 * deliberately tiny, like the rest of this engine.
 */
export function versionAt(cluster: ClusterState, app: string, at: number): string | undefined {
  let version: string | undefined
  for (const change of cluster.history) {
    if (change.app !== app || change.at > at) continue
    version = change.version
  }
  return version
}

/** Looks up the behaviour flags for a specific `app@version`. The engine never reads these itself. */
export function versionBehaviour(
  config: ClusterConfig,
  app: string,
  version: string
): Record<string, unknown> {
  return config.versionBehaviour[`${app}@${version}`] ?? {}
}

export function findBox(cluster: ClusterState, id: string): Box | undefined {
  return cluster.boxes.find((box) => box.id === id)
}
