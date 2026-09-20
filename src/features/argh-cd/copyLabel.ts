import type { Copy } from '../../engine/cluster'

/**
 * A stable ordinal for one copy among its own app's copies (including a "leaving" ghost still on
 * screen — see `useAnimatedCopies`), sorted by id so a chip doesn't relabel itself as its siblings
 * come and go. The same copy gets the same number in the app view and the boxes view.
 */
export function ordinalFor(copy: Copy, sameAppCopies: Copy[]): number {
  const sorted = [...sameAppCopies].sort((a, b) => a.id.localeCompare(b.id))
  return sorted.findIndex((candidate) => candidate.id === copy.id) + 1
}
