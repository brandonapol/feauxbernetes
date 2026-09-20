import type { ClusterEvent } from '../../engine/cluster'
import type { CiNotice } from '../../engine/game'
import type { GitOpsEvent } from '../../engine/gitops'

/**
 * The three sources the "What's happening" feed draws from, and what each filter chip narrows to
 * (planning.md → "The Ops Console"). `deploys` and `checks` are always empty today: GitOps and CI
 * aren't wired into the game loop yet (see `CiNotice` and `GameState.gitopsEvents` in
 * `engine/game.ts`) — this file merges whatever's there, so the feed and its chips start working
 * the moment a future ticket starts pushing entries.
 */
export type FeedCategory = 'cluster' | 'deploys' | 'checks'

export interface FeedEntry {
  id: string
  at: number
  category: FeedCategory
  english: string
  raw: string
}

/**
 * All feed entries, oldest first — cluster, then gitops, then CI, merged by time. Takes the three
 * source arrays directly (rather than `GameState`) so a `useMemo` in `EventFeed` can key off them
 * as stable references, instead of a selector that would build a fresh array on every store read.
 */
export function buildFeed(
  clusterEvents: ClusterEvent[],
  gitopsEvents: GitOpsEvent[],
  ciNotices: CiNotice[]
): FeedEntry[] {
  const cluster: FeedEntry[] = clusterEvents.map((event, index) => ({
    id: `cluster-${index}`,
    at: event.at,
    category: 'cluster',
    english: event.english,
    raw: event.raw,
  }))
  const deploys: FeedEntry[] = gitopsEvents.map((event, index) => ({
    id: `gitops-${index}`,
    at: event.at,
    category: 'deploys',
    english: event.english,
    raw: event.raw,
  }))
  const checks: FeedEntry[] = ciNotices.map((notice, index) => ({
    id: `ci-${index}`,
    at: notice.at,
    category: 'checks',
    english: notice.english,
    raw: notice.raw,
  }))
  return [...cluster, ...deploys, ...checks].sort((a, b) => a.at - b.at)
}
