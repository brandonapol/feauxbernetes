import { makeId } from './ids'
import type { DeployCommit, GitOpsSpec, GitOpsState, PullRequest } from './types'

/**
 * Builds a fresh GitOps world: the deploy repo (with one seed commit, if `spec.wishes` is given,
 * the same way `createCluster` seeds cluster history), any app repos content wants pre-populated,
 * and no pull requests or Argh CD history yet.
 */
export function createGitOps(spec: GitOpsSpec): GitOpsState {
  const appRepos = Object.fromEntries((spec.appRepos ?? []).map((repo) => [repo.app, repo]))
  if (!spec.wishes || spec.wishes.length === 0) {
    return {
      config: spec.config,
      deployRepo: { commits: [], wishes: {} },
      appRepos,
      pullRequests: [],
      apps: {},
      nextId: 0,
    }
  }
  const wishes = Object.fromEntries(spec.wishes.map((wish) => [wish.app, wish]))
  const commit: DeployCommit = {
    id: makeId('commit', 0),
    author: 'system',
    message: 'Initial wishes',
    at: 0,
    wishes,
  }
  return {
    config: spec.config,
    deployRepo: { commits: [commit], wishes },
    appRepos,
    pullRequests: [],
    apps: {},
    nextId: 1,
  }
}

export function findPullRequest(gitops: GitOpsState, id: string): PullRequest | undefined {
  return gitops.pullRequests.find((pr) => pr.id === id)
}

/** The commit currently at the head of the deploy repo, if there's been one. */
export function latestCommit(gitops: GitOpsState): DeployCommit | undefined {
  return gitops.deployRepo.commits.at(-1)
}
