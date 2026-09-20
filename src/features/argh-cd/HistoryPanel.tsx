import { appSyncStatus, diffInEnglish, type SyncHistoryEntry } from '../../engine/gitops'
import { useDispatch, useGame } from '../../store'
import styles from './AppView.module.css'
import { upForText } from './duration'

export function HistoryPanel({ app }: { app: string }) {
  const gitops = useGame((s) => s.game.gitops)
  const cluster = useGame((s) => s.game.cluster)
  const now = useGame((s) => s.game.clock.now)
  const dispatch = useDispatch()
  const history = gitops.apps[app]?.history ?? []
  const pendingHealAt = gitops.apps[app]?.pendingHealAt
  const repoWish = gitops.deployRepo.wishes[app]
  const clusterWish = cluster.wishes[app]
  const sync = appSyncStatus(gitops, cluster, app)
  const lastRollback = history.at(-1)?.trigger === 'rollback'

  return (
    <section className={styles.gitops} aria-label="GitOps">
      <div className={styles.gitnubSays}>
        <p>
          <strong>GitNub says</strong>{' '}
          {repoWish ? `${repoWish.copies} copies of ${repoWish.version}` : 'nothing yet'}
        </p>
        <p>
          <strong>Cluster has</strong>{' '}
          {clusterWish ? `${clusterWish.copies} copies of ${clusterWish.version}` : 'nothing yet'}
        </p>
      </div>

      {sync !== 'Synced' && (
        <p className={styles.diff} role="status">
          {diffInEnglish(repoWish, clusterWish)}
        </p>
      )}

      {pendingHealAt !== undefined && pendingHealAt > now && (
        <p className={styles.heal} role="status">
          Argh CD will put this back in {Math.max(1, Math.round((pendingHealAt - now) / 1000))}s.
        </p>
      )}

      {lastRollback && sync !== 'Synced' && repoWish && (
        <p className={styles.heal} role="status">
          GitNub still says {repoWish.version} — Argh CD will put it back. To make this stick,
          revert in GitNub.
        </p>
      )}

      <button
        type="button"
        className={styles.syncButton}
        data-target={`sync:${app}`}
        disabled={!repoWish}
        onClick={() => dispatch({ type: 'sync', app })}
      >
        Sync
      </button>

      <h3 className={styles.historyHeading}>History &amp; Rollback</h3>
      {history.length === 0 ? (
        <p className={styles.empty}>No syncs yet.</p>
      ) : (
        <ol className={styles.history}>
          {history
            .slice()
            .reverse()
            .map((entry) => (
              <HistoryRow key={entry.id} app={app} entry={entry} now={now} />
            ))}
        </ol>
      )}
    </section>
  )
}

function HistoryRow({ app, entry, now }: { app: string; entry: SyncHistoryEntry; now: number }) {
  const dispatch = useDispatch()
  return (
    <li className={styles.historyRow}>
      <div>
        <strong>{entry.version}</strong> · {entry.copies} copies · {triggerLabel(entry.trigger)}
        <div className={styles.muted}>{upForText(entry.at, now)} ago</div>
      </div>
      <button
        type="button"
        className={styles.rollbackButton}
        data-target={`rollback:${entry.id}`}
        onClick={() => dispatch({ type: 'rollback', app, historyId: entry.id })}
      >
        Rollback
      </button>
    </li>
  )
}

function triggerLabel(trigger: SyncHistoryEntry['trigger']): string {
  switch (trigger) {
    case 'auto-sync':
      return 'auto-sync'
    case 'manual-sync':
      return 'manual sync'
    case 'self-heal':
      return 'self-heal'
    case 'rollback':
      return 'rollback'
  }
}
