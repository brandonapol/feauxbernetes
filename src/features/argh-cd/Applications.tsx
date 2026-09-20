import { Link } from 'react-router'

import { health, summary, type ClusterState } from '../../engine/cluster'
import { SERVICES, type ServiceInfo } from '../../content'
import { useGame } from '../../store'
import styles from './Applications.module.css'
import { HealthBadge } from './HealthBadge'
import { wantsHasText } from './display'
import { applicationsSummarySentence } from './summaries'

/**
 * One tile per app — name, health, and "wants 3 · has 3" — plus the database tile with its 🐉
 * badge. See planning.md → "Argh CD, part 1".
 */
export function Applications() {
  const cluster = useGame((s) => s.game.cluster)
  const apps = SERVICES.filter((service) => service.id !== 'database')
  const database = SERVICES.find((service) => service.id === 'database')

  return (
    <div>
      <h1 className={styles.heading}>Applications</h1>
      <p className={styles.summary}>
        {applicationsSummarySentence(
          cluster,
          apps.map((app) => app.id)
        )}
      </p>
      <ul className={styles.tiles}>
        {apps.map((service) => (
          <li key={service.id}>
            <AppTile service={service} cluster={cluster} />
          </li>
        ))}
        {database && (
          <li>
            <DatabaseTile service={database} cluster={cluster} />
          </li>
        )}
      </ul>
    </div>
  )
}

function AppTile({ service, cluster }: { service: ServiceInfo; cluster: ClusterState }) {
  return (
    <Link
      to={`/argh-cd/app/${service.id}`}
      className={styles.tile}
      data-target={`app:${service.id}`}
    >
      <h2 className={styles.tileName}>{service.name}</h2>
      <p className={styles.tileDescription}>{service.description}</p>
      <HealthBadge health={health(cluster, service.id)} />
      <p className={styles.wantsHas}>{wantsHasText(summary(cluster, service.id))}</p>
      <p className={styles.tileVersion}>version {cluster.wishes[service.id]?.version ?? '—'}</p>
    </Link>
  )
}

function DatabaseTile({ service, cluster }: { service: ServiceInfo; cluster: ClusterState }) {
  const { database } = cluster
  return (
    <Link to="/argh-cd/database" className={styles.tile} data-target="database">
      <h2 className={styles.tileName}>
        <span aria-hidden="true">🐉</span> {service.name}
      </h2>
      <p className={styles.tileDescription}>{service.description}</p>
      <HealthBadge health={database.health} />
      <p className={styles.tileVersion}>version {database.version}</p>
    </Link>
  )
}
