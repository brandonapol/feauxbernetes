/**
 * End-to-end proof of the ticket's acceptance criterion "a failed required job blocks mergePR,"
 * exercised through the real seam: CI never touches gitops itself, it only computes the status
 * `setPRChecks` expects. This is the one file in this package that imports gitops, and only to
 * prove the two engines actually fit together the way both their doc comments claim.
 */
import { describe, expect, it } from 'vitest'

import { approvePR, createGitOps, mergePR, openPR, setPRChecks, type GitOpsConfig } from '../gitops'
import { SIGNUP_BUG_BEHAVIOUR, WEB_E2E_SUITE } from './__fixtures__/webE2eSuite'
import { createCiState } from './ci'
import { prCheckStatus, runJob, schedulePipeline } from './pipelines'

const GITOPS_CONFIG: GitOpsConfig = { autoSyncDelayMs: 1000, selfHealDelayMs: 1000 }

describe('CI blocking a PR merge through gitops.setPRChecks', () => {
  it('a failed end-to-end job leaves the PR checks-failed, and mergePR refuses it', () => {
    let gitops = createGitOps({ config: GITOPS_CONFIG })
    const opened = openPR(
      gitops,
      {
        repo: 'inkwell/web',
        title: 'Ship web 1.9: a stricter sign-up email check',
        author: 'Alex',
        change: {
          kind: 'version',
          app: 'web',
          version: { version: '1.9', author: 'Alex', summary: '', behaviour: SIGNUP_BUG_BEHAVIOUR },
        },
      },
      0
    )
    gitops = opened.gitops
    const pr = opened.pullRequest

    let ci = createCiState()
    const scheduled = schedulePipeline(
      ci,
      {
        prId: pr.id,
        service: 'web',
        suite: WEB_E2E_SUITE,
        behaviour: SIGNUP_BUG_BEHAVIOUR,
        buildDurationMs: 4000,
        unitTestDurationMs: 6000,
      },
      0
    )
    ci = scheduled.ci
    const pipeline = scheduled.pipeline
    gitops = setPRChecks(gitops, pr.id, prCheckStatus(pipeline), pipeline.id)
    expect(gitops.pullRequests[0].status).toBe('checks-running')

    ci = runJob(ci, pipeline.id, `${pipeline.id}-e2e`)
    const failedPipeline = ci.pipelines[pipeline.id]
    gitops = setPRChecks(gitops, pr.id, prCheckStatus(failedPipeline), failedPipeline.id)
    expect(gitops.pullRequests[0].status).toBe('checks-failed')

    // GitNub only shows Approve while a PR is 'open' — approving here is a no-op, and merging an
    // unapproved PR throws. Both are gitops's own guarantees; this just proves CI's status feeds
    // them correctly.
    gitops = approvePR(gitops, pr.id, 'Kai')
    expect(gitops.pullRequests[0].status).toBe('checks-failed')
    expect(() => mergePR(gitops, pr.id, 100)).toThrow()
  })

  it('a green pipeline hands the PR back to open, so it can be approved and merged', () => {
    let gitops = createGitOps({ config: GITOPS_CONFIG })
    const opened = openPR(
      gitops,
      {
        repo: 'inkwell/web',
        title: 'Ship web 1.9: a stricter sign-up email check',
        author: 'Alex',
        change: {
          kind: 'version',
          app: 'web',
          version: { version: '1.9', author: 'Alex', summary: '', behaviour: {} },
        },
      },
      0
    )
    gitops = opened.gitops
    const pr = opened.pullRequest

    let ci = createCiState()
    const scheduled = schedulePipeline(
      ci,
      {
        prId: pr.id,
        service: 'web',
        suite: WEB_E2E_SUITE,
        behaviour: {},
        buildDurationMs: 4000,
        unitTestDurationMs: 6000,
      },
      0
    )
    ci = scheduled.ci
    ci = runJob(ci, scheduled.pipeline.id, `${scheduled.pipeline.id}-e2e`)
    const greenPipeline = ci.pipelines[scheduled.pipeline.id]

    gitops = setPRChecks(gitops, pr.id, prCheckStatus(greenPipeline), greenPipeline.id)
    expect(gitops.pullRequests[0].status).toBe('open')

    gitops = approvePR(gitops, pr.id, 'Kai')
    expect(gitops.pullRequests[0].status).toBe('approved')

    const merged = mergePR(gitops, pr.id, 100)
    expect(merged.pullRequest.status).toBe('merged')
  })
})
