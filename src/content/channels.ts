import type { Channel } from '../engine/story/types'

// TODO(#12): grow this into Flack's real channel list (#platform, #deploys, #alerts, DMs and the
// dynamic #inc-<n>-<slug> incident channel) as chapter content needs each one.
export const CHANNELS: Channel[] = [
  { id: 'platform', name: 'platform', kind: 'channel', topic: 'The whole platform team.' },
]

export const DEFAULT_CHANNEL = 'platform'
