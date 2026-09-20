import type { ClusterEvent } from '../../engine/cluster'

/**
 * The copy drawer's "last few English log lines": the cluster's own event feed (see
 * `engine/cluster/events.ts`), filtered to one copy and trimmed to the most recent few. This is
 * real cluster history, not invented flavour text — a copy that hasn't done anything lately (no
 * crash, no restart) can come back with fewer than `limit` lines, or none at all.
 */
export function copyLogLines(events: ClusterEvent[], copyId: string, limit = 5): string[] {
  return events
    .filter((event) => event.copyId === copyId)
    .slice(-limit)
    .map((event) => event.english)
}
