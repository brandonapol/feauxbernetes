import { buildEvent, type ClusterEvent } from './events'
import { makeCopyId } from './ids'
import type { Box, ClusterState, Copy, Wish } from './types'

/**
 * One pass of the "keep it true" loop: bring `copies` a single step closer to `wishes`, per app,
 * and return the events that step raised. Never jumps straight to the desired state — that's what
 * makes a rollout, a scale-up or a crash recovery something the learner can *watch* happen.
 */
export function reconcile(
  cluster: ClusterState,
  now: number
): { cluster: ClusterState; events: ClusterEvent[] } {
  const events: ClusterEvent[] = []

  let copies = evictOffBoxCopies(cluster, now, events)
  copies = advanceTimers(copies, cluster.config, now, events)

  let seq = cluster.nextCopySeq
  for (const app of Object.keys(cluster.wishes)) {
    const wish = cluster.wishes[app]
    const result = reconcileApp(app, wish, cluster.boxes, copies, seq, now, events)
    copies = result.copies
    seq = result.nextCopySeq
  }

  return { cluster: { ...cluster, copies, nextCopySeq: seq }, events }
}

/** A box that's off takes its copies with it. They reappear on other boxes once there's room. */
function evictOffBoxCopies(cluster: ClusterState, now: number, events: ClusterEvent[]): Copy[] {
  const boxById = new Map(cluster.boxes.map((box) => [box.id, box]))
  return cluster.copies.filter((copy) => {
    const box = boxById.get(copy.boxId)
    if (box?.on) return true
    events.push(
      buildEvent(now, 'Evicted', {
        app: copy.app,
        copyId: copy.id,
        boxId: copy.boxId,
        boxName: box?.name,
      })
    )
    return false
  })
}

/** Advances every copy's own clock: finishes starting, finishes stopping, restarts a crash. */
function advanceTimers(
  copies: Copy[],
  config: ClusterState['config'],
  now: number,
  events: ClusterEvent[]
): Copy[] {
  const survivors: Copy[] = []
  for (const copy of copies) {
    if (copy.state === 'Starting' && now - copy.startedAt >= config.startupMs) {
      survivors.push({ ...copy, state: 'Running' })
      events.push(buildEvent(now, 'SuccessfulCreate', { app: copy.app, copyId: copy.id }))
      continue
    }
    if (copy.state === 'Stopping' && now - copy.startedAt >= config.stopMs) {
      events.push(buildEvent(now, 'Stopped', { app: copy.app, copyId: copy.id }))
      continue
    }
    if (copy.state === 'Crashed') {
      survivors.push({ ...copy, state: 'Starting', startedAt: now, restarts: copy.restarts + 1 })
      events.push(buildEvent(now, 'BackOff', { app: copy.app, copyId: copy.id }))
      continue
    }
    survivors.push(copy)
  }
  return survivors
}

function boxRoom(box: Box, copies: Copy[]): number {
  return box.capacity - copies.filter((copy) => copy.boxId === box.id).length
}

function pickBoxWithRoom(boxes: Box[], copies: Copy[]): Box | undefined {
  return boxes.find((box) => box.on && boxRoom(box, copies) > 0)
}

function oldest(copies: Copy[]): Copy {
  return [...copies].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))[0]
}

/**
 * Which copy to stop when there's one too many. Stale-version copies go first (that's the rolling
 * update), then copies that hadn't finished starting yet, then the oldest Running copy.
 */
function pickCopyToStop(running: Copy[], starting: Copy[], wish: Wish): Copy {
  const stale = running.filter((copy) => copy.version !== wish.version)
  if (stale.length > 0) return oldest(stale)
  if (starting.length > 0) return oldest(starting)
  return oldest(running)
}

/** One reconcile step for a single app: start one copy, stop one copy, or do nothing. */
function reconcileApp(
  app: string,
  wish: Wish,
  boxes: Box[],
  copies: Copy[],
  nextCopySeq: number,
  now: number,
  events: ClusterEvent[]
): { copies: Copy[]; nextCopySeq: number } {
  const appCopies = copies.filter((copy) => copy.app === app)
  const running = appCopies.filter((copy) => copy.state === 'Running')
  const starting = appCopies.filter((copy) => copy.state === 'Starting')
  const stopping = appCopies.filter((copy) => copy.state === 'Stopping')
  const total = running.length + starting.length

  if (total > wish.copies) {
    const victim = pickCopyToStop(running, starting, wish)
    events.push(buildEvent(now, 'Killing', { app, copyId: victim.id }))
    return { copies: stopCopy(copies, victim.id, now), nextCopySeq }
  }

  if (total < wish.copies) {
    const box = pickBoxWithRoom(boxes, copies)
    if (!box) {
      events.push(
        buildEvent(now, 'FailedScheduling', { app, wants: wish.copies, has: running.length })
      )
      return { copies, nextCopySeq }
    }
    const id = makeCopyId(app, nextCopySeq)
    const created: Copy = {
      id,
      app,
      version: wish.version,
      boxId: box.id,
      state: 'Starting',
      startedAt: now,
      restarts: 0,
    }
    events.push(buildEvent(now, 'Scheduled', { app, copyId: id, boxId: box.id, boxName: box.name }))
    return { copies: [...copies, created], nextCopySeq: nextCopySeq + 1 }
  }

  // At the right count. If some Running copies are still on the old version, swap one at a time:
  // stop one now, and the `total < wish.copies` branch above will start its replacement next tick.
  // Waiting for any in-flight Starting/Stopping to settle first keeps it to one copy at a time and
  // is what guarantees Running never drops below `copies - 1`.
  const stale = running.filter((copy) => copy.version !== wish.version)
  if (stale.length > 0 && starting.length === 0 && stopping.length === 0) {
    const victim = oldest(stale)
    events.push(buildEvent(now, 'Killing', { app, copyId: victim.id }))
    return { copies: stopCopy(copies, victim.id, now), nextCopySeq }
  }

  return { copies, nextCopySeq }
}

function stopCopy(copies: Copy[], id: string, now: number): Copy[] {
  return copies.map((copy) =>
    copy.id === id ? { ...copy, state: 'Stopping', startedAt: now } : copy
  )
}
