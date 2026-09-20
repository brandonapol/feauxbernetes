/**
 * GitOps events, in both raw form (what a real Argh CD sync log would say) and the English
 * translation the Ops Console shows — the same raw/english split as the cluster engine's events,
 * so the two feeds read as one stream. Only the four things Argh CD actually *does on its own
 * clock* get an event here: opening/approving/merging a PR is a direct, already-plain-English UI
 * action in GitNub and doesn't need translating.
 */
import type { SyncTrigger } from './types'

export const GITOPS_EVENT_KINDS = ['AutoSync', 'SelfHeal', 'ManualSync', 'Rollback'] as const

export type GitOpsEventKind = (typeof GITOPS_EVENT_KINDS)[number]

export interface GitOpsEvent {
  at: number
  kind: GitOpsEventKind
  raw: string
  english: string
  appId: string
}

/** `#deploys` gets a one-line plain-data notice for the same four events. This engine only ever
 * returns data — wrapping one in a `gitOpsNotice` effect (see `story/types.ts`) and applying it
 * turns it into a `#deploys` Flack message from the Argh CD bot. That wiring is #12's; actually
 * calling `sync`/`tick` from the store's `reduce` and emitting the effect is #16's (Argh CD, part
 * 2), once the gitops engine's state slot on `GameState` stops being a placeholder. */
export interface GitOpsNotice {
  at: number
  channel: 'deploys'
  text: string
  appId: string
}

interface EventContext {
  app: string
  version: string
  copies: number
}

const copiesPhrase = (copies: number): string => `${copies} cop${copies === 1 ? 'y' : 'ies'}`

interface EventText {
  raw(ctx: EventContext): string
  english(ctx: EventContext): string
  notice(ctx: EventContext): string
}

const EVENT_TEXT: Record<GitOpsEventKind, EventText> = {
  AutoSync: {
    raw: (ctx) => `Sync operation succeeded for ${ctx.app}`,
    english: (ctx) =>
      `Argh CD made the cluster match GitNub: ${ctx.app} is now ${copiesPhrase(ctx.copies)} of ${ctx.version}.`,
    notice: (ctx) => `Argh CD synced ${ctx.app} to ${ctx.version} ✅`,
  },
  SelfHeal: {
    raw: (ctx) => `Self heal succeeded for ${ctx.app}`,
    english: (ctx) =>
      `Someone changed ${ctx.app} by hand. Argh CD put it back to what GitNub says: ${copiesPhrase(ctx.copies)} of ${ctx.version}.`,
    notice: (ctx) =>
      `Argh CD noticed ${ctx.app} had drifted and healed it back to ${ctx.version} ✅`,
  },
  ManualSync: {
    raw: (ctx) => `Sync operation succeeded for ${ctx.app} (manual)`,
    english: (ctx) =>
      `A teammate clicked Sync. Argh CD made the cluster match GitNub for ${ctx.app}: ${copiesPhrase(ctx.copies)} of ${ctx.version}.`,
    notice: (ctx) => `Argh CD synced ${ctx.app} to ${ctx.version} ✅`,
  },
  Rollback: {
    raw: (ctx) => `Rollback applied for ${ctx.app}`,
    english: (ctx) =>
      `Rolled ${ctx.app} back to ${ctx.version} directly in Argh CD. GitNub still says otherwise, so this won't stick unless it's fixed there too.`,
    notice: (ctx) =>
      `Argh CD rolled ${ctx.app} back to ${ctx.version} in the cluster — GitNub hasn't changed, so this won't stick`,
  },
}

export function buildEvent(at: number, kind: GitOpsEventKind, ctx: EventContext): GitOpsEvent {
  const text = EVENT_TEXT[kind]
  return { at, kind, raw: text.raw(ctx), english: text.english(ctx), appId: ctx.app }
}

export function buildNotice(at: number, kind: GitOpsEventKind, ctx: EventContext): GitOpsNotice {
  return { at, channel: 'deploys', text: EVENT_TEXT[kind].notice(ctx), appId: ctx.app }
}

/** The event kind a given sync trigger raises. Kept as a lookup so `sync.ts` never hardcodes it twice. */
export const EVENT_KIND_FOR_TRIGGER: Record<SyncTrigger, GitOpsEventKind> = {
  'auto-sync': 'AutoSync',
  'self-heal': 'SelfHeal',
  'manual-sync': 'ManualSync',
  rollback: 'Rollback',
}
