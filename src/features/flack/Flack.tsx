import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useGame } from '../../store'
import { ChannelView } from './ChannelView'
import styles from './Flack.module.css'
import { Sidebar } from './Sidebar'
import { useChannels } from './useChannels'

/**
 * Ported from Flack. See planning.md → "Flack (#12)".
 *
 * Beyond Flack's original: the URL doesn't just win over `activeChannel`, it also *follows* it —
 * the same "story moved, follow it" pattern `useBrowserRouteSync` uses for tabs. Flack itself never
 * needed this (only a learner's click ever changed the active channel), but #12 adds the
 * `openChannel` effect for a script to focus a channel it didn't navigate to, e.g. #31's
 * `declareIncident` creating and focusing a new incident channel.
 */
export function Flack() {
  const channels = useChannels()
  const configuredDefault = useGame((s) => s.config.defaultChannel)
  const activeChannel = useGame((s) => s.game.flack.activeChannel)
  const dispatch = useGame((s) => s.dispatch)
  const navigate = useNavigate()
  const routeChannel = useParams().channel
  const lastActiveChannel = useRef(activeChannel)

  const known = channels.some((channel) => channel.id === routeChannel)
  const fallback =
    configuredDefault ??
    channels.find((channel) => channel.kind === 'channel')?.id ??
    channels[0].id
  const current = known ? routeChannel! : (activeChannel ?? fallback)

  // A script (not a click) changed the active channel: follow it, same as a learner would.
  useEffect(() => {
    if (lastActiveChannel.current === activeChannel) return
    lastActiveChannel.current = activeChannel
    if (activeChannel && activeChannel !== routeChannel) navigate(`/flack/${activeChannel}`)
  }, [activeChannel, routeChannel, navigate])

  // Keep the URL, the active channel and "read up to here" in step.
  useEffect(() => {
    if (!known) navigate(`/flack/${current}`, { replace: true })
  }, [known, current, navigate])

  useEffect(() => {
    dispatch({ type: 'openChannel', channel: current })
  }, [current, dispatch])

  return (
    <div className={styles.flack}>
      <Sidebar current={current} onOpen={(channel) => navigate(`/flack/${channel}`)} />
      <ChannelView channelId={current} />
    </div>
  )
}
