import type { Channel } from '../engine/story/types'

/**
 * Flack's static channels and DMs (planning.md → "Flack (#12)"): the whole team in `#platform`,
 * Argh CD's sync results in `#deploys`, PagerDoody's pages in `#alerts`, and DMs with Morgan and
 * Kai (Ask Kai lives in the Kai DM — see `mentorFaq.ts` and `config.ts`).
 *
 * The dynamic `#inc-<n>-<slug>` channel `declareIncident` (#31) creates isn't here: it doesn't
 * exist until an incident is declared, so it's held in `GameState.flack.dynamicChannels` instead
 * (added via the `createChannel` effect — see `engine/story/types.ts`). `incidentChannel` below is
 * the one place that builds its `Channel` shape, so #31 doesn't have to invent the id format.
 */
export const CHANNELS: Channel[] = [
  { id: 'platform', name: 'platform', kind: 'channel', topic: 'The whole platform team.' },
  { id: 'deploys', name: 'deploys', kind: 'channel', topic: 'Argh CD posts every sync here.' },
  { id: 'alerts', name: 'alerts', kind: 'channel', topic: 'PagerDoody posts pages here.' },
  { id: 'dm-morgan', name: 'Morgan Diaz', kind: 'dm', characterId: 'morgan' },
  { id: 'dm-kai', name: 'Kai Nakamura', kind: 'dm', characterId: 'kai' },
]

export const DEFAULT_CHANNEL = 'platform'

/** The DM Ask Kai lives in. See `content/mentorFaq.ts` and `content/config.ts`. */
export const MENTOR_CHANNEL = 'dm-kai'

/** `inc-3-billing-outage`, matching planning.md's `#inc-<n>-<slug>` format. */
export function incidentChannelId(number: number, slug: string): string {
  return `inc-${number}-${slug}`
}

/**
 * Builds the dynamic incident channel's `Channel`. The incident engine (#31) is expected to pass
 * this to a `createChannel` effect (see `engine/story/types.ts`) when an incident is declared, and
 * follow it with an `openChannel` effect so the learner lands there — see the acceptance criterion
 * "declaring an incident creates and focuses the new channel."
 */
export function incidentChannel(number: number, slug: string, topic?: string): Channel {
  const id = incidentChannelId(number, slug)
  return { id, name: id, kind: 'channel', topic }
}
