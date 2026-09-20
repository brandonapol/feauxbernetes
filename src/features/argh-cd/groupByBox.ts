import type { Box } from '../../engine/cluster'
import type { AnimatedCopy } from './useAnimatedCopies'

export interface BoxGroup {
  box: Box
  entries: AnimatedCopy[]
}

/** Every box, in content order, with the entries whose copy currently sits on it — including
 * empty boxes, and a box that's off, so "nothing's here" and "this box is off" are both visible. */
export function groupByBox(entries: AnimatedCopy[], boxes: Box[]): BoxGroup[] {
  return boxes.map((box) => ({
    box,
    entries: entries.filter((entry) => entry.copy.boxId === box.id),
  }))
}
