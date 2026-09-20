import { describe, expect, it } from 'vitest'

import { createCluster, setWish, type ClusterState, type Copy } from '../../engine/cluster'
import { createCiState, schedulePipeline } from '../../engine/ci'
import { approvePR, createGitOps, mergePR, openPR, setPRChecks } from '../../engine/gitops'
import {
  activeChange,
  boxState,
  checksSummary,
  describeActiveChange,
  STRIP_BOXES,
} from './whereIsMyChange'

const T0 = 1_700_000_000

function baseCluster(): ClusterState {
  return createCluster({
    boxes: [{ id: 'box-a', name: 'Box A', capacity: 4, on: true }],
    database: { version: '1.0', health: 'Healthy' },
    config: { startupMs: 1000, stopMs: 500, versionBehaviour: {} },
  })
}

describe('activeChange', () => {
  it('is undefined with no pull requests yet', () => {
    expect(
      activeChange(
        createGitOps({ config: { autoSyncDelayMs: 1000, selfHealDelayMs: 1000 } }),
        baseCluster()
      )
    ).toBeUndefined()
  })

  it('walks a wish change from open PR through checks, merge, sync and running', () => {
    let gitops = createGitOps({ config: { autoSyncDelayMs: 1000, selfHealDelayMs: 1000 } })
    let cluster = baseCluster()

    const opened = openPR(
      gitops,
      {
        repo: 'inkwell/deploy',
        title: 'Keep 3 copies of search',
        author: 'player',
        change: { kind: 'wish', app: 'search', wish: { app: 'search', version: '1.4', copies: 3 } },
      },
      T0
    )
    gitops = opened.gitops
    const prId = opened.pullRequest.id

    let change = activeChange(gitops, cluster)!
    expect(change.stage).toBe('pr-open')
    expect(change.app).toBe('search')
    expect(boxState(change, 0)).toBe('current')
    expect(boxState(change, 1)).toBe('todo')
    expect(describeActiveChange(change)).toContain('open for review')

    gitops = setPRChecks(gitops, prId, 'checks-running')
    change = activeChange(gitops, cluster)!
    expect(change.stage).toBe('checks-running')
    expect(boxState(change, 0)).toBe('done')
    expect(boxState(change, 1)).toBe('current')

    gitops = setPRChecks(gitops, prId, 'checks-failed')
    change = activeChange(gitops, cluster)!
    expect(change.stage).toBe('checks-failed')
    expect(boxState(change, 1)).toBe('failed')
    expect(describeActiveChange(change)).toContain('checks failed')

    // Checks pass on a retry: back to 'open', then approved and merged.
    gitops = setPRChecks(gitops, prId, 'open')
    gitops = approvePR(gitops, prId, 'kai')
    gitops = mergePR(gitops, prId, T0 + 1000).gitops

    change = activeChange(gitops, cluster)!
    expect(change.stage).toBe('merged')
    expect(boxState(change, 2)).toBe('current')
    expect(boxState(change, 1)).toBe('done')
    expect(describeActiveChange(change)).toContain('waiting for Argh CD')

    // Argh CD asks the cluster for the new wish (still starting up): 'syncing'.
    cluster = setWish(cluster, { app: 'search', version: '1.4', copies: 3 }, T0 + 2000)
    change = activeChange(gitops, cluster)!
    expect(change.stage).toBe('syncing')
    expect(boxState(change, 3)).toBe('current')

    // The copies are up and healthy: 'running'.
    const copies: Copy[] = [0, 1, 2].map((i) => ({
      id: `search-${i}`,
      app: 'search',
      version: '1.4',
      boxId: 'box-a',
      state: 'Running',
      startedAt: T0,
      restarts: 0,
    }))
    cluster = { ...cluster, copies }
    change = activeChange(gitops, cluster)!
    expect(change.stage).toBe('running')
    expect(boxState(change, 4)).toBe('current')
    expect(boxState(change, 0)).toBe('done')
    expect(describeActiveChange(change)).toContain('running on the cluster')
  })
})

describe('checksSummary', () => {
  it('reads the real pipeline scheduled for the PR', () => {
    const gitops = createGitOps({ config: { autoSyncDelayMs: 1000, selfHealDelayMs: 1000 } })
    const opened = openPR(
      gitops,
      {
        repo: 'inkwell/web',
        title: 'Ship 1.9',
        author: 'alex',
        change: {
          kind: 'version',
          app: 'web',
          version: { version: '1.9', author: 'alex', summary: 'Bump', behaviour: {} },
        },
      },
      T0
    )
    let ci = createCiState()
    ci = schedulePipeline(
      ci,
      {
        prId: opened.pullRequest.id,
        service: 'web',
        suite: [],
        behaviour: {},
        buildDurationMs: 100,
        unitTestDurationMs: 100,
      },
      T0
    ).ci

    expect(checksSummary(ci, opened.pullRequest)).toBe('2 of 4 checks passed')
  })

  it('is undefined before a pipeline has been scheduled', () => {
    const gitops = createGitOps({ config: { autoSyncDelayMs: 1000, selfHealDelayMs: 1000 } })
    const opened = openPR(
      gitops,
      {
        repo: 'inkwell/deploy',
        title: 'x',
        author: 'a',
        change: { kind: 'wish', app: 'search', wish: { app: 'search', version: '1.4', copies: 1 } },
      },
      T0
    )
    expect(checksSummary(createCiState(), opened.pullRequest)).toBeUndefined()
  })
})

describe('STRIP_BOXES', () => {
  it('has exactly the five stages planning.md describes', () => {
    expect(STRIP_BOXES.map((box) => box.label)).toEqual([
      'PR opened',
      'Checks',
      'Merged',
      'Argh CD',
      'Running',
    ])
  })
})
