import { Link } from 'react-router'

import { useGame } from '../../store'
import styles from './DatabaseView.module.css'
import { HealthBadge } from './HealthBadge'
import { databaseSummarySentence } from './summaries'

/**
 * The database: health, version, a plain-English "why can't I unplug this?" card, and a slot for
 * the operator's upgrade stages (bonus #39). No "Unplug this copy" here at all — the database
 * isn't a copy the cluster can just throw away and replace. See planning.md → "How much
 * Kubernetes?".
 */
export function DatabaseView() {
  const database = useGame((s) => s.game.cluster.database)

  return (
    <div>
      <p className={styles.breadcrumb}>
        <Link to="/argh-cd/applications">← Applications</Link>
      </p>
      <h1 className={styles.heading}>
        <span aria-hidden="true">🐉</span> database
      </h1>
      <HealthBadge health={database.health} />
      <p className={styles.version}>version {database.version}</p>
      <p className={styles.summary}>{databaseSummarySentence(database.health, database.version)}</p>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Why can't I unplug this?</h2>
        <p>
          The database remembers everything — accounts, documents and orders. A copy of web can be
          thrown away and replaced without anyone noticing; the database can't, because whatever
          replaces it has to have exactly what it had a moment ago. A specialised, careful robot (an
          operator) handles changes like that one careful step at a time, which is why there's no
          "Unplug this copy" button here.
        </p>
      </section>

      <section className={styles.card} aria-label="Upgrade status">
        <h2 className={styles.cardTitle}>Upgrade</h2>
        {database.upgrade ? (
          <p>{database.upgrade}</p>
        ) : (
          <p className={styles.muted}>
            No upgrade running right now. When the operator runs one, its careful step-by-step dance
            shows up here.
          </p>
        )}
      </section>
    </div>
  )
}
