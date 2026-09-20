import { Link } from 'react-router'

import { health, summary, type ClusterState } from '../../engine/cluster'
import { appSyncStatus, type GitOpsState } from '../../engine/gitops'
import { SERVICES, type ServiceInfo } from '../../content'
import { useDispatch, useGame } from '../../store'
import styles from './Applications.module.css'
import { HealthBadge } from './HealthBadge'
import { SyncBadge } from './SyncBadge'
import { wantsHasText } from './display'
import { upForText } from './duration'
import { applicationsSummarySentence } from './summaries'

/**
 * One tile per app — name, health, and "wants 3 · has 3" — plus the database tile with its 🐉
 * badge. See planning.md → "Argh CD, part 1".
 */
export function Applications() {
  const cluster = useGame((s) => s.game.cluster)
  const gitops = useGame((s) => s.game.gitops)
  const now = useGame((s) => s.game.clock.now)
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
            <AppTile service={service} cluster={cluster} gitops={gitops} now={now} />
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

function AppTile({
  service,
  cluster,
  gitops,
  now,
}: {
  service: ServiceInfo
  cluster: ClusterState
  gitops: GitOpsState
  now: number
}) {
  const dispatch = useDispatch()
  const repoWish = gitops.deployRepo.wishes[service.id]
  const running = cluster.wishes[service.id]
  const last = gitops.apps[service.id]?.history.at(-1)
  return (
    <Link
      to={`/argh-cd/app/${service.id}`}
      className={styles.tile}
      data-target={`app:${service.id}`}
      onClick={() => dispatch({ type: 'clickTarget', targetId: `app:${service.id}` })}
    >
      <h2 className={styles.tileName}>{service.name}</h2>
      <p className={styles.tileDescription}>{service.description}</p>
      <HealthBadge health={health(cluster, service.id)} />
      <SyncBadge status={appSyncStatus(gitops, cluster, service.id)} />
      <p className={styles.wantsHas}>{wantsHasText(summary(cluster, service.id))}</p>
      <p className={styles.tileVersion}>
        {repoWish
          ? `GitNub asks for ${repoWish.version} · running ${running?.version ?? '—'}`
          : `version ${running?.version ?? '—'}`}
      </p>
      {last && <p className={styles.tileVersion}>Last sync {upForText(last.at, now)} ago</p>}
    </Link>
  )
}

function DatabaseTile({ service, cluster }: { service: ServiceInfo; cluster: ClusterState }) {
  const { database } = cluster
  const dispatch = useDispatch()
  return (
    <Link
      to="/argh-cd/database"
      className={styles.tile}
      data-target="database"
      onClick={() => dispatch({ type: 'clickTarget', targetId: 'database' })}
    >
      <h2 className={styles.tileName}>
        <span aria-hidden="true">🐉</span> {service.name}
      </h2>
      <p className={styles.tileDescription}>{service.description}</p>
      <HealthBadge health={database.health} />
      <p className={styles.tileVersion}>version {database.version}</p>
    </Link>
  )
}
