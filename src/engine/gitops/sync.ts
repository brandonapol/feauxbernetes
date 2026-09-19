/**
 * Argh CD's real job (Ch 4 onward, planning.md → "Argh CD, part 2"): compare what GitNub asks for
 * to what the cluster runs, and keep them in line. `tick` is the one entry point the store calls
 * each fake-clock tick — it advances the cluster's own reconcile loop *and* Argh CD's sync/heal
 * timers, so the Ops Console can show both feeds as one stream.
 */
import { reconcile, setWish, summary } from '../cluster'
import type { ClusterEvent, ClusterState, Wish } from '../cluster'
import { buildEvent, buildNotice, EVENT_KIND_FOR_TRIGGER } from './events'
import type { GitOpsEvent, GitOpsNotice } from './events'
import { latestCommit } from './gitops'
import { makeId } from './ids'
import type {
  ArghAppState,
  GitOpsState,
  Health,
  SyncHistoryEntry,
  SyncStatus,
  SyncTrigger,
} from './types'

function wishesEqual(a: Wish | undefined, b: Wish | undefined): boolean {
  if (!a || !b) return false
  return a.version === b.version && a.copies === b.copies
}

function copiesPhrase(copies: number): string {
  return `${copies} cop${copies === 1 ? 'y' : 'ies'}`
}

/**
 * "GitNub says 3 copies. The cluster has 6. Someone changed it by hand." — the drift explanation
 * shown in the app view's Diff. Reports every field that differs, then names the cause.
 */
export function diffInEnglish(repoWish: Wish | undefined, clusterWish: Wish | undefined): string {
  if (!repoWish) return "GitNub doesn't have a wish for this app yet."
  if (!clusterWish) {
    return `GitNub says ${copiesPhrase(repoWish.copies)} of ${repoWish.version}. The cluster isn't running it yet.`
  }
  const parts: string[] = []
  if (repoWish.copies !== clusterWish.copies) {
    parts.push(`GitNub says ${repoWish.copies} copies. The cluster has ${clusterWish.copies}.`)
  }
  if (repoWish.version !== clusterWish.version) {
    parts.push(
      `GitNub says version ${repoWish.version}. The cluster is running ${clusterWish.version}.`
    )
  }
  if (parts.length === 0) {
    return `GitNub and the cluster agree: ${copiesPhrase(repoWish.copies)} of ${repoWish.version}.`
  }
  parts.push('Someone changed it by hand.')
  return parts.join(' ')
}

/** Compares GitNub's wish to the cluster's, the way the sync-status tile does. */
export function appSyncStatus(gitops: GitOpsState, cluster: ClusterState, app: string): SyncStatus {
  const repoWish = gitops.deployRepo.wishes[app]
  if (!repoWish) return 'Synced' // nothing asked of GitNub yet, so nothing to be out of sync about
  if (!wishesEqual(repoWish, cluster.wishes[app])) return 'OutOfSync'
  return appHealth(cluster, app) === 'Healthy' ? 'Synced' : 'Syncing'
}

/** Reads health straight from the cluster's copy counts: wants vs has, starting, stopping. */
export function appHealth(cluster: ClusterState, app: string): Health {
  const line = summary(cluster, app)
  if (line.wants === 0) return 'Healthy'
  if (line.has === line.wants && line.starting === 0 && line.stopping === 0) return 'Healthy'
  if (line.starting > 0 || line.stopping > 0) return 'Progressing'
  return 'Degraded' // has < wants and nothing in flight: stuck, e.g. no box has room
}

function emptyAppState(app: string): ArghAppState {
  return { app, history: [] }
}

function recordSync(
  gitops: GitOpsState,
  trigger: SyncTrigger,
  wish: Wish,
  now: number
): { entry: SyncHistoryEntry; nextId: number } {
  return {
    entry: {
      id: makeId('sync', gitops.nextId),
      at: now,
      commitId: trigger === 'rollback' ? undefined : latestCommit(gitops)?.id,
      version: wish.version,
      copies: wish.copies,
      trigger,
    },
    nextId: gitops.nextId + 1,
  }
}

export interface SyncResult {
  gitops: GitOpsState
  cluster: ClusterState
  events: GitOpsEvent[]
  notices: GitOpsNotice[]
}

/** Applies `wish` to the cluster right now, records the history entry, and raises its event/notice. */
function applySync(
  gitops: GitOpsState,
  cluster: ClusterState,
  app: string,
  wish: Wish,
  trigger: SyncTrigger,
  now: number
): SyncResult {
  const state = gitops.apps[app] ?? emptyAppState(app)
  const { entry, nextId } = recordSync(gitops, trigger, wish, now)
  const nextCluster = setWish(cluster, wish, now)
  const kind = EVENT_KIND_FOR_TRIGGER[trigger]
  const ctx = { app, version: wish.version, copies: wish.copies }
  return {
    gitops: {
      ...gitops,
      nextId,
      apps: {
        ...gitops.apps,
        [app]: {
          ...state,
          history: [...state.history, entry],
          pendingSyncAt: undefined,
          pendingHealAt: undefined,
        },
      },
    },
    cluster: nextCluster,
    events: [buildEvent(now, kind, ctx)],
    notices: [buildNotice(now, kind, ctx)],
  }
}

export interface TickResult {
  gitops: GitOpsState
  cluster: ClusterState
  /** Cluster reconcile events and Argh CD sync events, in one feed, for the Ops Console. */
  events: Array<GitOpsEvent | ClusterEvent>
  notices: GitOpsNotice[]
}

/**
 * One fake-clock tick: advances the cluster's reconcile loop, then walks every app GitNub has a
 * wish for and either waits, auto-syncs a pending merge, or schedules/runs self-heal on drift it
 * didn't cause. Never touches an app GitNub has no wish for yet — that's Ch 1-3, before GitOps
 * exists.
 */
export function tick(gitops: GitOpsState, cluster: ClusterState, now: number): TickResult {
  const clusterResult = reconcile(cluster, now)
  let nextCluster = clusterResult.cluster
  const events: GitOpsEvent[] = []
  const notices: GitOpsNotice[] = []
  const apps: Record<string, ArghAppState> = { ...gitops.apps }
  let nextId = gitops.nextId

  for (const app of Object.keys(gitops.deployRepo.wishes)) {
    const repoWish = gitops.deployRepo.wishes[app]
    const state = apps[app] ?? emptyAppState(app)
    const clusterWish = nextCluster.wishes[app]

    if (wishesEqual(repoWish, clusterWish)) {
      apps[app] = { ...state, pendingSyncAt: undefined, pendingHealAt: undefined }
      continue
    }

    if (state.pendingSyncAt !== undefined) {
      if (now < state.pendingSyncAt) {
        apps[app] = state
        continue
      }
      const { entry, nextId: afterEntry } = recordSync(
        { ...gitops, nextId },
        'auto-sync',
        repoWish,
        now
      )
      nextId = afterEntry
      nextCluster = setWish(nextCluster, repoWish, now)
      apps[app] = { ...state, history: [...state.history, entry], pendingSyncAt: undefined }
      const ctx = { app, version: repoWish.version, copies: repoWish.copies }
      events.push(buildEvent(now, 'AutoSync', ctx))
      notices.push(buildNotice(now, 'AutoSync', ctx))
      continue
    }

    if (state.pendingHealAt === undefined) {
      // Drift Argh CD didn't schedule itself: give the learner a window to fix it in GitNub
      // before self-heal steps in.
      apps[app] = { ...state, pendingHealAt: now + gitops.config.selfHealDelayMs }
      continue
    }

    if (now < state.pendingHealAt) {
      apps[app] = state
      continue
    }

    const { entry, nextId: afterEntry } = recordSync(
      { ...gitops, nextId },
      'self-heal',
      repoWish,
      now
    )
    nextId = afterEntry
    nextCluster = setWish(nextCluster, repoWish, now)
    apps[app] = { ...state, history: [...state.history, entry], pendingHealAt: undefined }
    const ctx = { app, version: repoWish.version, copies: repoWish.copies }
    events.push(buildEvent(now, 'SelfHeal', ctx))
    notices.push(buildNotice(now, 'SelfHeal', ctx))
  }

  return {
    gitops: { ...gitops, apps, nextId },
    cluster: nextCluster,
    events: [...clusterResult.events, ...events],
    notices,
  }
}

/** The **Sync** button: applies GitNub's wish right now, instead of waiting for auto-sync. */
export function sync(
  gitops: GitOpsState,
  cluster: ClusterState,
  app: string,
  now: number
): SyncResult {
  const repoWish = gitops.deployRepo.wishes[app]
  if (!repoWish) throw new Error(`GitNub has no wish for ${app} yet`)
  return applySync(gitops, cluster, app, repoWish, 'manual-sync', now)
}

/**
 * Argh CD's own **History & Rollback**: re-applies an earlier synced wish straight to the cluster,
 * bypassing GitNub entirely. Deliberately doesn't touch the deploy repo — if GitNub still says a
 * newer version, the very next `tick` will see that as drift and schedule self-heal, undoing the
 * rollback. That's not a bug: it's the same "changes here are temporary" lesson the Ops Console
 * teaches from Ch 4 onward, applied to Argh CD's own rollback button. `revertPR` (pullRequests.ts)
 * is the version of this that actually sticks, because it fixes GitNub instead.
 */
export function rollback(
  gitops: GitOpsState,
  cluster: ClusterState,
  app: string,
  historyId: string,
  now: number
): SyncResult {
  const state = gitops.apps[app]
  const entry = state?.history.find((candidate) => candidate.id === historyId)
  if (!entry) throw new Error(`No sync history entry ${historyId} for ${app}`)
  const wish: Wish = { app, version: entry.version, copies: entry.copies }
  return applySync(gitops, cluster, app, wish, 'rollback', now)
}
