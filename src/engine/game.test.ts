import { describe, expect, it } from 'vitest'

import {
  basicCluster,
  boxes,
  config as clusterConfig,
  DATABASE,
} from './cluster/__fixtures__/basicCluster'
import { createCluster } from './cluster/cluster'
import type { ClusterState } from './cluster/types'
import { WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR } from './ci/__fixtures__/webE2eSuite'
import { basicCluster as gitopsCluster, basicGitOps } from './gitops/__fixtures__/basicGitOps'
import { toyConfig } from './story/__fixtures__/toyChapter'
import { play } from './story/harness'
import { blankState, initialState, reduce, type Action, type GameState } from './game'

const config = toyConfig()

function withCluster(state: GameState, cluster: ClusterState): GameState {
  return { ...state, cluster }
}

describe('blankState', () => {
  it('starts with an empty cluster and no cluster events', () => {
    const state = blankState(config)
    expect(state.cluster.boxes).toEqual([])
    expect(state.cluster.copies).toEqual([])
    expect(state.cluster.wishes).toEqual({})
    expect(state.clusterEvents).toEqual([])
  })
})

describe('reduce: tick', () => {
  it('advances the clock by exactly deltaMs and runs one reconcile pass', () => {
    const start = withCluster(initialState(config).state, basicCluster())
    const before = start.clock.now

    const { state } = reduce(config, start, { type: 'tick', deltaMs: 1000 })

    expect(state.clock.now).toBe(before + 1000)
    // basicCluster wishes 3 copies of search onto two empty boxes with room for 3 each: one
    // reconcile pass starts as many as it has room for in one step... actually reconcile starts
    // one copy per app per pass when under wish, so exactly one Scheduled copy appears.
    expect(state.cluster.copies).toHaveLength(1)
    expect(state.cluster.copies[0]).toMatchObject({
      app: 'search',
      version: 'v1',
      state: 'Starting',
    })
  })

  it('surfaces reconcile events onto clusterEvents, appended in order', () => {
    const start = withCluster(initialState(config).state, basicCluster())
    const first = reduce(config, start, { type: 'tick', deltaMs: 10 })
    const second = reduce(config, first.state, { type: 'tick', deltaMs: 10 })

    expect(first.state.clusterEvents.map((e) => e.kind)).toEqual(['Scheduled'])
    expect(second.state.clusterEvents.length).toBeGreaterThan(first.state.clusterEvents.length)
    // Events accumulate rather than being replaced.
    expect(second.state.clusterEvents[0]).toEqual(first.state.clusterEvents[0])
  })

  it('advances a copy all the way to Running once enough fake time passes', () => {
    let state = withCluster(initialState(config).state, basicCluster())
    // startupMs is 100 in the fixture config; tick past it.
    for (let i = 0; i < 5; i++) {
      state = reduce(config, state, { type: 'tick', deltaMs: 30 }).state
    }
    expect(state.cluster.copies.some((c) => c.state === 'Running')).toBe(true)
  })

  it("doesn't touch story state (no learner event is raised for a tick)", () => {
    const start = withCluster(initialState(config).state, basicCluster())
    const { state } = reduce(config, start, { type: 'tick', deltaMs: 10 })
    expect(state.story).toEqual(start.story)
  })
})

describe('reduce: cluster wishes', () => {
  it('chooseWish sets the wish via the cluster engine', () => {
    const start = withCluster(
      initialState(config).state,
      createCluster({ boxes: boxes(), database: DATABASE, config: clusterConfig() })
    )
    const { state } = reduce(config, start, {
      type: 'chooseWish',
      app: 'search',
      version: 'v1',
      copies: 3,
    })
    expect(state.cluster.wishes.search).toEqual({ app: 'search', version: 'v1', copies: 3 })
  })

  it('unplugCopy removes the copy via the cluster engine', () => {
    let state = withCluster(initialState(config).state, basicCluster())
    state = reduce(config, state, { type: 'tick', deltaMs: 10 }).state
    const copyId = state.cluster.copies[0].id
    state = reduce(config, state, { type: 'unplugCopy', copyId }).state
    expect(state.cluster.copies.find((c) => c.id === copyId)).toBeUndefined()
  })

  it('setBox flips a box on or off via the cluster engine', () => {
    const start = withCluster(initialState(config).state, basicCluster())
    const { state } = reduce(config, start, { type: 'setBox', boxId: 'box-1', on: false })
    expect(state.cluster.boxes.find((b) => b.id === 'box-1')?.on).toBe(false)
  })

  it('crashCopy marks a copy Crashed via the cluster engine', () => {
    let state = withCluster(initialState(config).state, basicCluster())
    state = reduce(config, state, { type: 'tick', deltaMs: 10 }).state
    const copyId = state.cluster.copies[0].id
    state = reduce(config, state, { type: 'crashCopy', copyId }).state
    expect(state.cluster.copies.find((c) => c.id === copyId)?.state).toBe('Crashed')
  })
})

describe('determinism', () => {
  it('produces identical state for the same sequence of actions from the same start', () => {
    // The copy id the cluster hands out is a deterministic hash of its name and a counter (see
    // `ids.ts`), not a random value, so it's looked up rather than hard-coded — both runs land on
    // the same id regardless.
    const run = (): GameState => {
      let state = withCluster(initialState(config).state, basicCluster())
      const apply = (action: Action) => {
        state = reduce(config, state, action).state
      }
      apply({ type: 'tick', deltaMs: 25 })
      apply({ type: 'clickTarget', targetId: 'start' })
      apply({ type: 'setPlayerName', name: 'Ada Lovelace' })
      apply({ type: 'tick', deltaMs: 150 })
      apply({ type: 'chooseOption', stepId: 'wish', optionId: 'three' })
      apply({ type: 'unplugCopy', copyId: state.cluster.copies[0].id })
      apply({ type: 'setBox', boxId: 'box-2', on: false })
      apply({ type: 'tick', deltaMs: 200 })
      return state
    }

    const first = run()
    const second = run()
    expect(second).toEqual(first)
    // A sanity check that the sequence actually did something, so this isn't vacuously true.
    expect(first.cluster.copies.length).toBeGreaterThan(0)
    expect(first.clusterEvents.length).toBeGreaterThan(0)
  })
})

describe('reduce: GitNub / CI (#15)', () => {
  const withSuites = { ...config, testSuites: { web: WEB_E2E_SUITE } }

  function gitWorld(): GameState {
    return {
      ...initialState(withSuites).state,
      cluster: gitopsCluster(),
      gitops: basicGitOps(),
    }
  }

  it('openPR on a wish change schedules a pipeline, auto-runs e2e, and records a CI notice', () => {
    const { state, effects } = reduce(withSuites, gitWorld(), {
      type: 'openPR',
      repo: 'inkwell/deploy',
      title: 'Bump search to v2',
      change: { kind: 'wish', app: 'search', wish: { app: 'search', version: 'v2', copies: 3 } },
      reviewers: ['kai'],
    })
    expect(state.gitops.pullRequests).toHaveLength(1)
    const pr = state.gitops.pullRequests[0]
    expect(pr.status).toBe('open')
    expect(pr.pipelineId).toBeDefined()
    expect(state.ciNotices.length).toBeGreaterThan(0)
    expect(effects.some((effect) => effect.type === 'approvePR' && effect.reviewer === 'kai')).toBe(
      true
    )
  })

  it('merge is a no-op until the PR is approved, then mergePR lands the wish', () => {
    let state = gitWorld()
    state = reduce(withSuites, state, {
      type: 'openPR',
      repo: 'inkwell/deploy',
      title: 'Bump search to v2',
      change: { kind: 'wish', app: 'search', wish: { app: 'search', version: 'v2', copies: 3 } },
    }).state
    const prId = state.gitops.pullRequests[0].id
    const blocked = reduce(withSuites, state, { type: 'mergePR', prId })
    expect(blocked.state.gitops.pullRequests[0].status).not.toBe('merged')

    state = reduce(withSuites, state, { type: 'approvePR', prId, reviewer: 'kai' }).state
    state = reduce(withSuites, state, { type: 'mergePR', prId }).state
    expect(state.gitops.pullRequests[0].status).toBe('merged')
    expect(state.gitops.deployRepo.wishes.search?.version).toBe('v2')
  })

  it('a version PR with a failing flag stays checks-failed until the learner runs e2e and then Suggest a fix', () => {
    let state = gitWorld()
    state = reduce(withSuites, state, {
      type: 'openPR',
      repo: 'inkwell/web',
      title: 'Stricter sign-up email check',
      change: {
        kind: 'version',
        app: 'web',
        version: {
          version: '1.9',
          author: 'alex',
          summary: 'Reject bad emails',
          behaviour: SIGNUP_BUG_BEHAVIOUR,
        },
      },
    }).state
    const pr = state.gitops.pullRequests[0]
    expect(pr.status).toBe('checks-running')
    const pipeline = state.ci.pipelines[pr.pipelineId!]
    const e2e = pipeline.stages.find((stage) => stage.name === 'End-to-end tests')!.jobs[0]
    state = reduce(withSuites, state, {
      type: 'runJob',
      pipelineId: pipeline.id,
      jobId: e2e.id,
    }).state
    expect(state.gitops.pullRequests[0].status).toBe('checks-failed')
    expect(state.ciNotices.some((notice) => /failed/i.test(notice.english))).toBe(true)

    state = reduce(withSuites, state, {
      type: 'suggestFix',
      prId: pr.id,
      fix: 'fix-code',
    }).state
    const next = state.gitops.pullRequests[0]
    expect(next.change.kind === 'version' && next.change.version.behaviour).toEqual({})
    expect(next.status).toBe('checks-running')
  })

  it('play() can open, approve and merge a wish PR end to end', () => {
    const start = gitWorld()
    const opened = reduce(withSuites, start, {
      type: 'openPR',
      repo: 'inkwell/deploy',
      title: 'Bump search',
      change: { kind: 'wish', app: 'search', wish: { app: 'search', version: 'v2', copies: 3 } },
      reviewers: ['kai'],
    })
    const prId = opened.state.gitops.pullRequests[0].id
    const state = play(withSuites, opened.state, [
      { type: 'approvePR', prId, reviewer: 'kai' },
      { type: 'mergePR', prId },
    ])
    expect(state.gitops.pullRequests[0].status).toBe('merged')
  })
})

describe('reduce: Argh CD sync / rollback (#16)', () => {
  function syncedWorld(): GameState {
    return {
      ...initialState(config).state,
      cluster: gitopsCluster(),
      gitops: basicGitOps(),
    }
  }

  it('sync is a no-op when GitNub has no wish, and records a ManualSync when it does', () => {
    const empty = initialState(config).state
    const skipped = reduce(config, empty, { type: 'sync', app: 'search' })
    expect(skipped.state.gitopsEvents).toEqual([])

    const { state } = reduce(config, syncedWorld(), { type: 'sync', app: 'search' })
    expect(state.gitopsEvents.some((event) => event.kind === 'ManualSync')).toBe(true)
    expect(state.gitops.apps.search?.history.some((entry) => entry.trigger === 'manual-sync')).toBe(
      true
    )
  })
})
