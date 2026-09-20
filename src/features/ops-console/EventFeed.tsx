import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { currentChapter } from '../../engine/story'
import { useGame } from '../../store'
import { buildFeed, type FeedCategory } from './feed'
import styles from './EventFeed.module.css'

const FILTERS: Array<{ id: 'all' | FeedCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'cluster', label: 'Cluster' },
  { id: 'deploys', label: 'Deploys' },
  { id: 'checks', label: 'Checks' },
]

/**
 * How often the live region can announce a new line. Reconcile can raise several `clusterEvents`
 * on a single tick, and ticks come every `TICK_INTERVAL_MS` — announcing every one of them would
 * flood a screen reader, so only the most recent line since the last flush gets read out, at most
 * this often.
 */
const ANNOUNCE_THROTTLE_MS = 1500

/** A trailing-edge throttle: `latest` can change as often as it likes, but the returned value
 * only catches up at most once per `ANNOUNCE_THROTTLE_MS`, always landing on the newest value. */
function useThrottled(latest: string | undefined, ms: number): string {
  const [announced, setAnnounced] = useState('')
  const lastFlushAt = useRef(0)
  const pending = useRef<string | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (latest === undefined) return
    pending.current = latest

    const flush = () => {
      timer.current = undefined
      lastFlushAt.current = Date.now()
      if (pending.current !== undefined) setAnnounced(pending.current)
    }

    const elapsed = Date.now() - lastFlushAt.current
    if (elapsed >= ms) {
      flush()
    } else if (!timer.current) {
      timer.current = setTimeout(flush, ms - elapsed)
    }
  }, [latest, ms])

  useEffect(() => () => clearTimeout(timer.current), [])

  return announced
}

/**
 * The "What's happening" half of the Ops Console (#13): cluster, GitOps and CI events, English
 * first, each expandable to its raw text (a native `<details>`, so it's keyboard operable for
 * free). Filter chips narrow the list; the `aria-live` region separately announces the latest
 * line, throttled so a burst of events doesn't flood a screen reader.
 */
export function EventFeed() {
  // Select the three source arrays individually — each is a stable reference until its own slice
  // of state changes — and merge them in a `useMemo`. Selecting `buildFeed(s.game)` directly would
  // hand `useSyncExternalStore` a fresh array on every read and spin into an update loop.
  const clusterEvents = useGame((s) => s.game.clusterEvents)
  const gitopsEvents = useGame((s) => s.game.gitopsEvents)
  const ciNotices = useGame((s) => s.game.ciNotices)
  const chapterId = useGame((s) => currentChapter(s.config, s.game)?.id)
  const quietStartup = chapterId === '00-welcome' || chapterId === '01-boxes'
  const entries = useMemo(() => {
    const cluster = quietStartup
      ? clusterEvents.filter(
          (event) => event.kind !== 'SuccessfulCreate' && event.kind !== 'Scheduled'
        )
      : clusterEvents
    return buildFeed(cluster, gitopsEvents, ciNotices)
  }, [clusterEvents, gitopsEvents, ciNotices, quietStartup])

  const [filter, setFilter] = useState<'all' | FeedCategory>('all')
  const scrollRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((entry) => entry.category === filter)),
    [entries, filter]
  )
  const announcement = useThrottled(filtered.at(-1)?.english, ANNOUNCE_THROTTLE_MS)

  useLayoutEffect(() => {
    const scroller = scrollRef.current
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [filtered.length])

  return (
    <section className={styles.feed} aria-labelledby="ops-console-feed-heading">
      <h2 id="ops-console-feed-heading" className={styles.heading}>
        What&rsquo;s happening
      </h2>
      {quietStartup && (
        <p className={styles.caption}>
          The cluster is starting copies in the background — you don’t need to click these.
        </p>
      )}
      <div className={styles.chips} role="group" aria-label="Filter the feed">
        {FILTERS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={filter === chip.id}
            className={filter === chip.id ? styles.chipActive : styles.chip}
            onClick={() => setFilter(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className={styles.scroller} ref={scrollRef}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>Nothing here yet.</p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((entry) => (
              <li key={entry.id}>
                <details>
                  <summary>{entry.english}</summary>
                  <pre className={styles.raw}>{entry.raw}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {announcement}
      </div>
    </section>
  )
}
