// A tiny seeded PRNG, ported from the same mulberry32 already used to fuzz-test the cluster
// engine (see cluster/reconcile.test.ts) and the fnv1a hash from cluster/ids.ts. Not
// cryptographic — it only has to be fast, deterministic, and look random enough.

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * A number in `[0, 1)`, deterministic for a given key. Unlike a stream from `mulberry32`, this
 * has no state to carry between calls — the same key always gives the same number, so a single
 * point of a series can be recomputed on its own, in any order, and a scenario tweak that changes
 * one point never ripples into the ones after it.
 */
export function hash01(key: string): number {
  return mulberry32(fnv1a(key, 0x811c9dc5))()
}

/** A number in `[-1, 1)`, for noise that should average out to zero. */
export function noise(key: string): number {
  return hash01(key) * 2 - 1
}
