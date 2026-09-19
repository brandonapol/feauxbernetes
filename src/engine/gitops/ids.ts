// Deterministic ids, ported from the cluster engine's `ids.ts` (itself styled on Flack's
// `src/engine/git/hash.ts`): no Math.random, no Date.now, just a hash of a counter the caller
// already keeps (`GitOpsState.nextId`).

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * `commit-9c2a`, `pr-4f10`, `sync-0b7e` — a prefix plus a deterministic 4-hex-digit suffix. Not
 * cryptographic; it only has to look right and never collide across the handful of commits, PRs
 * and sync entries a playthrough creates.
 */
export function makeId(prefix: string, seq: number): string {
  const suffix = fnv1a(`${prefix}#${seq}`, 0x811c9dc5).toString(16).padStart(8, '0').slice(0, 4)
  return `${prefix}-${suffix}`
}
