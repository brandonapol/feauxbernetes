import { Link } from 'react-router'

import type { StatusComponentId, StatusComponentState } from '../../engine/game'
import { useGame } from '../../store'
import styles from './StatusPage.module.css'
import { componentState, STATUS_COMPONENT_LABEL, STATUS_COMPONENTS } from './site'

const STATE_LABEL: Record<StatusComponentState, string> = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  outage: 'Major outage',
}

const OVERALL_LABEL: Record<StatusComponentState, string> = {
  operational: 'All systems operational',
  degraded: 'Some systems degraded',
  outage: 'Some systems are down',
}

/** Worse of two states, where outage > degraded > operational. */
function worse(a: StatusComponentState, b: StatusComponentState): StatusComponentState {
  const rank: Record<StatusComponentState, number> = { operational: 0, degraded: 1, outage: 2 }
  return rank[b] > rank[a] ? b : a
}

function formatUpdateTime(at: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(at * 1000))
}

/**
 * status.inkwell.example: three components and their current state, plus the incident feed. The
 * feed renders whatever `game.statusPage.updates` holds — this ticket (#17) defines that state and
 * a `postStatusUpdate` action to write it, but never posts to it itself outside tests. The
 * incident engine (#31) is the real writer; see `engine/game.ts` → `StatusUpdate`.
 */
export function StatusPage() {
  const cluster = useGame((s) => s.game.cluster)
  const updates = useGame((s) => s.game.statusPage.updates)

  const components = Object.keys(STATUS_COMPONENTS) as StatusComponentId[]
  const states = components.map((component) => componentState(cluster, updates, component))
  const overall = states.reduce(worse, 'operational')

  const feed = [...updates].reverse()

  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <Link to="/inkwell">← inkwell.example</Link>
        <h1>Inkwell Status</h1>
      </header>
      <main className={styles.main}>
        <p className={`${styles.overall} ${styles[overall]}`}>{OVERALL_LABEL[overall]}</p>

        <ul className={styles.components} aria-label="Components">
          {components.map((component, index) => (
            <li key={component} className={styles.component}>
              <span>{STATUS_COMPONENT_LABEL[component]}</span>
              <span className={`${styles.badge} ${styles[states[index]]}`}>
                <span className={styles.dot} aria-hidden="true" />
                {STATE_LABEL[states[index]]}
              </span>
            </li>
          ))}
        </ul>

        <h2 className={styles.feedTitle}>Incident updates</h2>
        {feed.length === 0 ? (
          <p className={styles.empty}>No incidents reported.</p>
        ) : (
          <ul className={styles.feed} aria-label="Incident updates">
            {feed.map((update) => (
              <li key={update.id} className={styles.update}>
                <div className={styles.updateHead}>
                  <span className={styles.updateComponent}>
                    {STATUS_COMPONENT_LABEL[update.component]}
                  </span>
                  <span className={styles.updateTime}>{formatUpdateTime(update.at)}</span>
                  <span className={`${styles.badge} ${styles[update.state]}`}>
                    <span className={styles.dot} aria-hidden="true" />
                    {STATE_LABEL[update.state]}
                  </span>
                </div>
                <p className={styles.updateMessage}>{update.message}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
