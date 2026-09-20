import { useMemo } from 'react'

import type { Channel } from '../../engine/story/types'
import { useGame } from '../../store'

/**
 * `config.channels` (static content) plus `game.flack.dynamicChannels` (the `#inc-<n>-<slug>`
 * incident channel `declareIncident` (#31) creates), in sidebar order. Selectors must return a
 * stable value, so the two are selected separately and only combined once either changes — see
 * `ChannelView`'s comment on the same pattern.
 */
export function useChannels(): Channel[] {
  const staticChannels = useGame((s) => s.config.channels)
  const dynamicChannels = useGame((s) => s.game.flack.dynamicChannels)
  return useMemo(() => [...staticChannels, ...dynamicChannels], [staticChannels, dynamicChannels])
}
