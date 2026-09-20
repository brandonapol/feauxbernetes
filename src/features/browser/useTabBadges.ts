import type { Tab } from '../../engine/events'
import { useGame } from '../../store'

/**
 * Attention badges per tab. Only Flack's unread count exists today; the others are API only until
 * their engine lands (PagerDoody's open-page count with #26, Argh CD's "just synced" flag with
 * #16, …) — they simply stay `undefined` until then.
 */
export function useTabBadges(): Partial<Record<Tab, number>> {
  const unread = useGame((s) => {
    const { messages, readUpTo } = s.game.flack
    const perChannel = new Map<string, number>()
    for (const message of messages) {
      perChannel.set(message.channel, (perChannel.get(message.channel) ?? 0) + 1)
    }
    let total = 0
    perChannel.forEach((count, channel) => {
      total += Math.max(0, count - (readUpTo[channel] ?? 0))
    })
    return total
  })
  return { flack: unread > 0 ? unread : undefined }
}
