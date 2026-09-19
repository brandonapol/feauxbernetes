/**
 * Cluster events, in both raw form (what a real k8s event stream would say) and the English
 * translation the Ops Console shows. This is the one file that translation lives in — content and
 * UI never invent their own wording for a cluster event.
 */

export const CLUSTER_EVENT_KINDS = [
  'Scheduled',
  'SuccessfulCreate',
  'Killing',
  'Stopped',
  'BackOff',
  'Evicted',
  'FailedScheduling',
] as const

export type ClusterEventKind = (typeof CLUSTER_EVENT_KINDS)[number]

export interface ClusterEvent {
  at: number
  kind: ClusterEventKind
  raw: string
  english: string
  appId?: string
  copyId?: string
  boxId?: string
}

/** The bits of context a translation might need. Not every kind uses every field. */
export interface EventContext {
  app: string
  copyId?: string
  boxId?: string
  boxName?: string
  wants?: number
  has?: number
}

interface EventText {
  raw(ctx: EventContext): string
  english(ctx: EventContext): string
}

const box = (ctx: EventContext): string => ctx.boxName ?? ctx.boxId ?? 'a box'

const EVENT_TEXT: Record<ClusterEventKind, EventText> = {
  Scheduled: {
    raw: (ctx) => `Scheduled ${ctx.copyId} to ${ctx.boxId}`,
    english: (ctx) => `Starting a new copy of ${ctx.app} on ${box(ctx)}.`,
  },
  SuccessfulCreate: {
    raw: (ctx) => `SuccessfulCreate ${ctx.copyId}`,
    english: (ctx) => `A copy of ${ctx.app} finished starting. It's running.`,
  },
  Killing: {
    raw: (ctx) => `Killing ${ctx.copyId}`,
    english: (ctx) => `Stopping a copy of ${ctx.app}.`,
  },
  Stopped: {
    raw: (ctx) => `Stopped ${ctx.copyId}`,
    english: (ctx) => `A copy of ${ctx.app} has fully stopped.`,
  },
  BackOff: {
    raw: (ctx) => `BackOff restarting ${ctx.copyId}`,
    english: (ctx) => `A copy of ${ctx.app} crashed. Restarting it.`,
  },
  Evicted: {
    raw: (ctx) => `Evicted ${ctx.copyId}`,
    english: (ctx) =>
      `${box(ctx)} turned off, so a copy of ${ctx.app} went with it. Rescheduling it elsewhere.`,
  },
  FailedScheduling: {
    raw: (ctx) => `FailedScheduling ${ctx.app}`,
    english: (ctx) =>
      `No box has room for another copy of ${ctx.app}. It wants ${ctx.wants} and has ${ctx.has}.`,
  },
}

export function buildEvent(at: number, kind: ClusterEventKind, ctx: EventContext): ClusterEvent {
  const text = EVENT_TEXT[kind]
  return {
    at,
    kind,
    raw: text.raw(ctx),
    english: text.english(ctx),
    appId: ctx.app,
    ...(ctx.copyId ? { copyId: ctx.copyId } : {}),
    ...(ctx.boxId ? { boxId: ctx.boxId } : {}),
  }
}
