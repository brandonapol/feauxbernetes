import { describe, expect, it } from 'vitest'

import { setWish, summary } from '../cluster'
import type { ClusterState } from '../cluster'
import { basicCluster, basicGitOps } from './__fixtures__/basicGitOps'
import { approvePR, mergePR, openPR } from './pullRequests'
import { appHealth, appSyncStatus, diffInEnglish, rollback, sync, tick } from './sync'
import { DEPLOY_REPO } from './types'
import type { GitOpsState } from './types'

/** Ticks forward in fixed steps until `done`, or fails — mirrors the cluster engine's `driveUntil`. */
function driveUntil(
  gitops: GitOpsState,
  cluster: ClusterState,
  startNow: number,
  step: number,
  maxTicks: number,
  done: (gitops: GitOpsState, cluster: ClusterState) => boolean
): { gitops: GitOpsState; cluster: ClusterState; now: number; nextNow: number } {
  let now = startNow
  let g = gitops
  let c = cluster
  for (let i = 0; i < maxTicks; i++) {
    const result = tick(g, c, now)
    g = result.gitops
    c = result.cluster
    if (done(g, c)) return { gitops: g, cluster: c, now, nextNow: now + step }
    now += step
  }
  throw new Error(`did not converge within ${maxTicks} ticks`)
}

function fullyUp(cluster: ClusterState, app: string): boolean {
  const line = summary(cluster, app)
  return line.has === line.wants && line.starting === 0 && line.stopping === 0
}

describe('diffInEnglish', () => {
  it('names copies, version and hand-editing, matching the planning.md example', () => {
    expect(
      diffInEnglish(
        { app: 'search', version: 'v1', copies: 3 },
        { app: 'search', version: 'v1', copies: 6 }
      )
    ).toBe('GitNub says 3 copies. The cluster has 6. Someone changed it by hand.')
  })

  it('says they agree when the wishes match', () => {
    const wish = { app: 'search', version: 'v1', copies: 3 }
    expect(diffInEnglish(wish, wish)).toBe('GitNub and the cluster agree: 3 copies of v1.')
  })

  it('handles a version-only difference and a missing cluster wish', () => {
    expect(
      diffInEnglish(
        { app: 'search', version: 'v2', copies: 3 },
        { app: 'search', version: 'v1', copies: 3 }
      )
    ).toBe('GitNub says version v2. The cluster is running v1. Someone changed it by hand.')
    expect(diffInEnglish({ app: 'search', version: 'v1', copies: 3 }, undefined)).toBe(
      "GitNub says 3 copies of v1. The cluster isn't running it yet."
    )
    expect(diffInEnglish(undefined, undefined)).toBe("GitNub doesn't have a wish for this app yet.")
  })
})

describe('appHealth', () => {
  it('is Healthy once has meets wants with nothing in flight', () => {
    const up = driveUntil(basicGitOps(), basicCluster(), 0, 10, 20, (_g, c) => fullyUp(c, 'search'))
    expect(appHealth(up.cluster, 'search')).toBe('Healthy')
  })

  it('is Degraded when short and nothing can start', () => {
    const cluster = basicCluster({ boxes: [] }) // nowhere to schedule
    const { cluster: reconciled } = tick(basicGitOps(), cluster, 0)
    expect(appHealth(reconciled, 'search')).toBe('Degraded')
  })
})

describe('tick: auto-sync', () => {
  it('leaves the cluster wish alone until the auto-sync delay elapses, then applies it', () => {
    const opened = openPR(
      basicGitOps(),
      {
        repo: DEPLOY_REPO,
        title: 'Bump search to v2',
        author: 'Alex Chen',
        change: { kind: 'wish', app: 'search', wish: { app: 'search', version: 'v2', copies: 3 } },
      },
      0
    )
    const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Kai Nakamura')
    const merged = mergePR(approved, opened.pullRequest.id, 0) // autoSyncDelayMs is 100

    const beforeDelay = tick(merged.gitops, basicCluster(), 50)
    expect(beforeDelay.cluster.wishes.search.version).toBe('v1')
    expect(appSyncStatus(beforeDelay.gitops, beforeDelay.cluster, 'search')).toBe('OutOfSync')
    expect(beforeDelay.events.some((event) => 'kind' in event && event.kind === 'AutoSync')).toBe(
      false
    )

    const afterDelay = tick(beforeDelay.gitops, beforeDelay.cluster, 100)
    expect(afterDelay.cluster.wishes.search.version).toBe('v2')
    expect(afterDelay.gitops.apps.search?.history).toHaveLength(1)
    expect(afterDelay.gitops.apps.search?.history[0]).toMatchObject({
      trigger: 'auto-sync',
      version: 'v2',
      copies: 3,
    })
    const event = afterDelay.events.find(
      (candidate) => 'kind' in candidate && candidate.kind === 'AutoSync'
    )
    expect(event).toMatchObject({
      english: expect.stringContaining('Argh CD made the cluster match GitNub'),
    })
    expect(afterDelay.notices).toEqual([
      { at: 100, channel: 'deploys', text: 'Argh CD synced search to v2 ✅', appId: 'search' },
    ])
  })
})

describe('tick: self-heal', () => {
  it('leaves manual drift alone until the self-heal delay elapses, then restores it and logs an event', () => {
    const gitops = basicGitOps()
    const drifted = setWish(basicCluster(), { app: 'search', version: 'v1', copies: 6 }, 0)

    const detected = tick(gitops, drifted, 0)
    expect(appSyncStatus(detected.gitops, detected.cluster, 'search')).toBe('OutOfSync')
    expect(detected.gitops.apps.search?.pendingHealAt).toBe(200) // selfHealDelayMs is 200

    const stillWaiting = tick(detected.gitops, detected.cluster, 100)
    expect(stillWaiting.cluster.wishes.search.copies).toBe(6)
    expect(stillWaiting.events.some((event) => 'kind' in event && event.kind === 'SelfHeal')).toBe(
      false
    )

    const healed = tick(stillWaiting.gitops, stillWaiting.cluster, 200)
    expect(healed.cluster.wishes.search.copies).toBe(3)
    expect(appSyncStatus(healed.gitops, healed.cluster, 'search')).not.toBe('OutOfSync')
    expect(healed.gitops.apps.search?.history[0]).toMatchObject({ trigger: 'self-heal', copies: 3 })
    const event = healed.events.find(
      (candidate) => 'kind' in candidate && candidate.kind === 'SelfHeal'
    )
    expect(event).toMatchObject({ english: expect.stringContaining('by hand') })
    expect(healed.notices[0].text).toContain('healed it back to v1')
  })
})

describe('sync (manual)', () => {
  it('applies GitNub’s wish immediately, without waiting for auto-sync', () => {
    const opened = openPR(
      basicGitOps(),
      {
        repo: DEPLOY_REPO,
        title: 'Bump search to v2',
        author: 'Alex Chen',
        change: { kind: 'wish', app: 'search', wish: { app: 'search', version: 'v2', copies: 3 } },
      },
      0
    )
    const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Kai Nakamura')
    const merged = mergePR(approved, opened.pullRequest.id, 0)

    const result = sync(merged.gitops, basicCluster(), 'search', 10)
    expect(result.cluster.wishes.search.version).toBe('v2')
    expect(result.gitops.apps.search?.pendingSyncAt).toBeUndefined()
    expect(result.notices[0].text).toBe('Argh CD synced search to v2 ✅')
  })

  it('throws when GitNub has no wish for the app yet', () => {
    expect(() => sync(basicGitOps(), basicCluster(), 'billing', 0)).toThrow(/no wish/)
  })
})

describe('rollback', () => {
  it('re-applies a past sync directly to the cluster without touching the deploy repo', () => {
    const opened = openPR(
      basicGitOps(),
      {
        repo: DEPLOY_REPO,
        title: 'Bump search to v2',
        author: 'Alex Chen',
        change: { kind: 'wish', app: 'search', wish: { app: 'search', version: 'v2', copies: 3 } },
      },
      0
    )
    const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Kai Nakamura')
    const merged = mergePR(approved, opened.pullRequest.id, 0)
    const synced = sync(merged.gitops, basicCluster(), 'search', 10)
    const historyId = synced.gitops.apps.search!.history[0].id

    // GitNub bumps again to v3.
    const openedAgain = openPR(
      synced.gitops,
      {
        repo: DEPLOY_REPO,
        title: 'Bump search to v3',
        author: 'Alex Chen',
        change: { kind: 'wish', app: 'search', wish: { app: 'search', version: 'v3', copies: 3 } },
      },
      20
    )
    const approvedAgain = approvePR(openedAgain.gitops, openedAgain.pullRequest.id, 'Kai Nakamura')
    const mergedAgain = mergePR(approvedAgain, openedAgain.pullRequest.id, 20)
    const syncedAgain = sync(mergedAgain.gitops, synced.cluster, 'search', 25)
    expect(syncedAgain.cluster.wishes.search.version).toBe('v3')

    const rolledBack = rollback(syncedAgain.gitops, syncedAgain.cluster, 'search', historyId, 30)
    expect(rolledBack.cluster.wishes.search.version).toBe('v2')
    expect(rolledBack.gitops.deployRepo.wishes.search.version).toBe('v3') // GitNub is unmoved
    expect(rolledBack.notices[0].text).toContain("won't stick")

    // The very next tick notices the drift and, eventually, self-heals it back to v3.
    const afterOneTick = tick(rolledBack.gitops, rolledBack.cluster, 30)
    expect(afterOneTick.gitops.apps.search?.pendingHealAt).toBe(
      30 + rolledBack.gitops.config.selfHealDelayMs
    )
  })

  it('throws for an unknown history entry', () => {
    expect(() => rollback(basicGitOps(), basicCluster(), 'search', 'sync-0000', 0)).toThrow()
  })
})
