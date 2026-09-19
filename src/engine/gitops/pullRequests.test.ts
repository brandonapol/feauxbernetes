import { describe, expect, it } from 'vitest'

import { basicGitOps } from './__fixtures__/basicGitOps'
import { findPullRequest } from './gitops'
import { approvePR, mergePR, openPR, revertPR, setPRChecks } from './pullRequests'
import { DEPLOY_REPO } from './types'

function openWishPR(gitops = basicGitOps(), version = 'v2', copies = 3) {
  return openPR(
    gitops,
    {
      repo: DEPLOY_REPO,
      title: `Bump search to ${version}`,
      author: 'Alex Chen',
      change: { kind: 'wish', app: 'search', wish: { app: 'search', version, copies } },
    },
    100
  )
}

describe('openPR', () => {
  it('opens a PR as `open`, with no approvals and nothing applied yet', () => {
    const { gitops, pullRequest } = openWishPR()
    expect(pullRequest.status).toBe('open')
    expect(pullRequest.approvedBy).toEqual([])
    expect(gitops.deployRepo.wishes.search).toEqual({ app: 'search', version: 'v1', copies: 3 })
    expect(findPullRequest(gitops, pullRequest.id)).toEqual(pullRequest)
  })

  it('gives sequential PRs distinct, deterministic ids', () => {
    const first = openWishPR()
    const second = openWishPR(first.gitops)
    expect(second.pullRequest.id).not.toBe(first.pullRequest.id)
  })
})

describe('approvePR', () => {
  it('records the reviewer and flips status to approved', () => {
    const { gitops, pullRequest } = openWishPR()
    const approved = approvePR(gitops, pullRequest.id, 'Kai Nakamura')
    const pr = findPullRequest(approved, pullRequest.id)!
    expect(pr.status).toBe('approved')
    expect(pr.approvedBy).toEqual(['Kai Nakamura'])
  })

  it('is a no-op on a PR that is not open (e.g. checks still running)', () => {
    const { gitops, pullRequest } = openWishPR()
    const running = setPRChecks(gitops, pullRequest.id, 'checks-running')
    const stillRunning = approvePR(running, pullRequest.id, 'Kai Nakamura')
    expect(findPullRequest(stillRunning, pullRequest.id)?.status).toBe('checks-running')
  })
})

describe('setPRChecks', () => {
  it('lets the CI engine drive checks state without touching approvals', () => {
    const { gitops, pullRequest } = openWishPR()
    const running = setPRChecks(gitops, pullRequest.id, 'checks-running', 'pipeline-1')
    expect(findPullRequest(running, pullRequest.id)).toMatchObject({
      status: 'checks-running',
      pipelineId: 'pipeline-1',
    })
    const failed = setPRChecks(running, pullRequest.id, 'checks-failed')
    expect(findPullRequest(failed, pullRequest.id)?.status).toBe('checks-failed')
  })
})

describe('mergePR', () => {
  it('throws when the PR is not approved', () => {
    const { gitops, pullRequest } = openWishPR()
    expect(() => mergePR(gitops, pullRequest.id, 200)).toThrow(/approved/)
  })

  it('commits the wish, updates deployRepo.wishes, and schedules an auto-sync', () => {
    const opened = openWishPR()
    const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Kai Nakamura')
    const { gitops, pullRequest } = mergePR(approved, opened.pullRequest.id, 200)

    expect(pullRequest.status).toBe('merged')
    expect(pullRequest.mergedAt).toBe(200)
    expect(gitops.deployRepo.wishes.search).toEqual({ app: 'search', version: 'v2', copies: 3 })
    expect(gitops.deployRepo.commits).toHaveLength(2)
    expect(gitops.deployRepo.commits[1]).toMatchObject({
      id: pullRequest.mergedCommitId,
      author: 'Alex Chen',
      at: 200,
    })
    expect(gitops.apps.search?.pendingSyncAt).toBe(200 + gitops.config.autoSyncDelayMs)
  })

  it('appends a version to the app repo for a version-kind change, without touching the deploy repo', () => {
    const opened = openPR(
      basicGitOps(),
      {
        repo: 'inkwell/search',
        title: 'Ship search 1.5',
        author: 'Alex Chen',
        change: {
          kind: 'version',
          app: 'search',
          version: {
            version: '1.5',
            author: 'Alex Chen',
            summary: 'Faster indexing',
            behaviour: {},
          },
        },
      },
      100
    )
    const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Kai Nakamura')
    const { gitops, pullRequest } = mergePR(approved, opened.pullRequest.id, 200)

    expect(pullRequest.mergedCommitId).toBeUndefined()
    expect(gitops.appRepos.search?.versions).toEqual([
      { version: '1.5', author: 'Alex Chen', summary: 'Faster indexing', behaviour: {} },
    ])
    expect(gitops.deployRepo.commits).toHaveLength(1) // unchanged: shipping code isn't deploying it
  })
})

describe('revertPR', () => {
  it('throws on a PR that was never merged', () => {
    const { gitops, pullRequest } = openWishPR()
    expect(() => revertPR(gitops, pullRequest.id, 300)).toThrow()
  })

  it('opens and immediately merges a new PR restoring the wish from before the original merge', () => {
    const opened = openWishPR()
    const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Kai Nakamura')
    const merged = mergePR(approved, opened.pullRequest.id, 200)

    const { gitops, pullRequest: revertedPr } = revertPR(merged.gitops, merged.pullRequest.id, 300)

    expect(revertedPr.status).toBe('merged')
    expect(revertedPr.id).not.toBe(merged.pullRequest.id)
    expect(gitops.deployRepo.wishes.search).toEqual({ app: 'search', version: 'v1', copies: 3 })
    expect(gitops.pullRequests).toHaveLength(2)
    expect(gitops.apps.search?.pendingSyncAt).toBe(300 + gitops.config.autoSyncDelayMs)
  })

  it('throws when there is no earlier wish to revert to', () => {
    // The very first commit has nothing before it.
    const opened = openPR(
      basicGitOps({ wishes: [] }),
      {
        repo: DEPLOY_REPO,
        title: 'Wish for billing',
        author: 'Alex Chen',
        change: {
          kind: 'wish',
          app: 'billing',
          wish: { app: 'billing', version: '1.0', copies: 2 },
        },
      },
      100
    )
    const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Kai Nakamura')
    const merged = mergePR(approved, opened.pullRequest.id, 200)
    expect(() => revertPR(merged.gitops, merged.pullRequest.id, 300)).toThrow(/earlier wish/)
  })
})
