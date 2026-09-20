import { useEffect, useState } from 'react'

import type { Copy } from '../../engine/cluster'

export interface AnimatedCopy {
  copy: Copy
  /** True for a copy that just disappeared from the cluster with no graceful `Stopping` period
   * (unplugged, or evicted along with a box that turned off) and is being shown one last time
   * while its exit animation (`CopyChip.module.css`'s `chip-leave`) plays. A copy that goes
   * through `Stopping` first is still a real entry in `copies` — it doesn't need this treatment,
   * since its own chip already reads "Stopping". */
  leaving: boolean
}

/** How long a departed chip stays on screen mid exit animation before it's dropped for good —
 * matches `chip-leave`'s duration in `CopyChip.module.css`. */
const EXIT_ANIMATION_MS = 220

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Keeps a copy on screen for one more moment after it vanishes abruptly, so "wants 3 · has 2, then
 * a replacement appears" is something the learner watches happen rather than a jump cut. Timed in
 * JS (rather than waiting on the chip's own `animationend`) so it settles the same way under
 * `prefers-reduced-motion: reduce` — instantly — as it does with the animation playing.
 */
export function useAnimatedCopies(copies: Copy[]): { entries: AnimatedCopy[] } {
  const [previous, setPrevious] = useState(copies)
  const [ghosts, setGhosts] = useState<Copy[]>([])

  if (copies !== previous) {
    const stillHere = new Set(copies.map((copy) => copy.id))
    const justLeft = previous.filter((copy) => !stillHere.has(copy.id))
    if (justLeft.length > 0) {
      const alreadyGhosted = new Set(ghosts.map((copy) => copy.id))
      setGhosts([...ghosts, ...justLeft.filter((copy) => !alreadyGhosted.has(copy.id))])
    }
    setPrevious(copies)
  }

  // One shared timer for every current ghost: simplest correct option, at the cost of a departure
  // that arrives while another is still fading resetting both to the full duration together —
  // never wrong, just occasionally a touch generous.
  useEffect(() => {
    if (ghosts.length === 0) return
    const delay = prefersReducedMotion() ? 0 : EXIT_ANIMATION_MS
    const handle = setTimeout(() => setGhosts([]), delay)
    return () => clearTimeout(handle)
  }, [ghosts])

  const liveIds = new Set(copies.map((copy) => copy.id))
  const entries: AnimatedCopy[] = [
    ...copies.map((copy) => ({ copy, leaving: false })),
    ...ghosts.filter((copy) => !liveIds.has(copy.id)).map((copy) => ({ copy, leaving: true })),
  ]

  return { entries }
}
