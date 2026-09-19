// Deterministic copy ids, ported from Flack's `src/engine/git/hash.ts` style: no Math.random, no
// Date.now, just a hash of the counter the cluster already keeps.

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * `search-9c2a` — the app name plus a deterministic 4-hex-digit suffix, matching the look of a
 * real k8s pod name. Not cryptographic — it only has to look right and never collide across the
 * handful of copies a playthrough creates.
 */
export function makeCopyId(app: string, seq: number): string {
  const suffix = fnv1a(`${app}#${seq}`, 0x811c9dc5).toString(16).padStart(8, '0').slice(0, 4)
  return `${app}-${suffix}`
}
