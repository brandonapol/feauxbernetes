import { describe, expect, it } from 'vitest'

import { basicGitOps, gitOpsConfig, SEARCH_WISH } from './__fixtures__/basicGitOps'
import { createGitOps, findPullRequest, latestCommit } from './gitops'

describe('createGitOps', () => {
  it('seeds one commit holding every wish given, and mirrors it as the current wishes', () => {
    const gitops = basicGitOps()
    expect(gitops.deployRepo.commits).toHaveLength(1)
    expect(gitops.deployRepo.commits[0]).toMatchObject({ at: 0, message: 'Initial wishes' })
    expect(gitops.deployRepo.wishes).toEqual({ search: SEARCH_WISH })
    expect(latestCommit(gitops)).toBe(gitops.deployRepo.commits[0])
  })

  it('starts with no commits, PRs or app history when no wishes are given', () => {
    const gitops = createGitOps({ config: gitOpsConfig() })
    expect(gitops.deployRepo).toEqual({ commits: [], wishes: {} })
    expect(gitops.pullRequests).toEqual([])
    expect(gitops.apps).toEqual({})
    expect(latestCommit(gitops)).toBeUndefined()
  })

  it('pre-populates app repos content wants seeded, keyed by app', () => {
    const gitops = createGitOps({
      config: gitOpsConfig(),
      appRepos: [{ app: 'billing', versions: [] }],
    })
    expect(gitops.appRepos.billing).toEqual({ app: 'billing', versions: [] })
  })
})

describe('findPullRequest', () => {
  it('returns undefined for an id that was never opened', () => {
    expect(findPullRequest(basicGitOps(), 'pr-0000')).toBeUndefined()
  })
})
