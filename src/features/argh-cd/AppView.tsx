import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import { health, summary } from '../../engine/cluster'
import { appSyncStatus } from '../../engine/gitops'
import { SERVICES } from '../../content'
import { useGame } from '../../store'
import styles from './AppView.module.css'
import { CopyChip } from './CopyChip'
import { copyLogLines } from './logLines'
import { CopyDrawer } from './CopyDrawer'
import { DeployCaption } from './DeployCaption'
import { wantsHasText } from './display'
import { ordinalFor } from './copyLabel'
import { groupByBox } from './groupByBox'
import { HealthBadge } from './HealthBadge'
import { HistoryPanel } from './HistoryPanel'
import { SyncBadge } from './SyncBadge'
import { appSummarySentence } from './summaries'
import { useAnimatedCopies } from './useAnimatedCopies'

/**
 * One app's copies, as small labelled circles grouped by the box they're on (planning.md → "Argh
 * CD, part 1"). Copies animate in and out, respecting `prefers-reduced-motion` (see
 * `useAnimatedCopies` and the global rule in `src/index.css`).
 */
export function AppView() {
  const { app = '' } = useParams()
  const service = SERVICES.find((candidate) => candidate.id === app && candidate.id !== 'database')
  const cluster = useGame((s) => s.game.cluster)
  const gitops = useGame((s) => s.game.gitops)
  const now = useGame((s) => s.game.clock.now)
  const clusterEvents = useGame((s) => s.game.clusterEvents)
  const canUnplug = useGame((s) => s.game.ui.canUnplugCopies)
  const dispatch = useGame((s) => s.dispatch)
  const [selectedCopyId, setSelectedCopyId] = useState<string>()

  const appCopies = useMemo(
    () => cluster.copies.filter((copy) => copy.app === app),
    [cluster.copies, app]
  )
  const { entries } = useAnimatedCopies(appCopies)
  const allCopies = entries.map((entry) => entry.copy)
  const groups = groupByBox(entries, cluster.boxes)
  const selectedCopy = allCopies.find((copy) => copy.id === selectedCopyId)

  if (!service) return <Navigate to="/argh-cd/applications" replace />

  return (
    <div>
      <p className={styles.breadcrumb}>
        <Link to="/argh-cd/applications">← Applications</Link>
      </p>
      <h1 className={styles.heading}>{service.name}</h1>
      <HealthBadge health={health(cluster, app)} />
      <SyncBadge status={appSyncStatus(gitops, cluster, app)} />
      <p className={styles.wantsHas}>{wantsHasText(summary(cluster, app))}</p>
      <p className={styles.summary}>{appSummarySentence(app, appCopies, cluster.boxes)}</p>
      <HistoryPanel app={app} />
      <DeployCaption
        copies={appCopies}
        wishedVersion={cluster.wishes[app]?.version}
        wishedCopies={cluster.wishes[app]?.copies ?? 0}
      />

      {groups.map(({ box, entries: boxEntries }) => (
        <section key={box.id} className={styles.boxGroup}>
          <h2 className={styles.boxName}>
            {box.name}
            {!box.on && (
              <span className={styles.offBadge} aria-label="off">
                off
              </span>
            )}
          </h2>
          {boxEntries.length > 0 ? (
            <ul className={styles.copies}>
              {boxEntries.map(({ copy, leaving }) => (
                <li key={copy.id}>
                  <CopyChip
                    copy={copy}
                    ordinal={ordinalFor(copy, allCopies)}
                    visibleLabel={String(ordinalFor(copy, allCopies))}
                    boxName={box.name}
                    leaving={leaving}
                    selected={copy.id === selectedCopyId}
                    onSelect={() => setSelectedCopyId(copy.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No copies of {app} here.</p>
          )}
        </section>
      ))}

      {selectedCopy && (
        <CopyDrawer
          copy={selectedCopy}
          boxName={cluster.boxes.find((box) => box.id === selectedCopy.boxId)?.name ?? 'a box'}
          now={now}
          logLines={copyLogLines(clusterEvents, selectedCopy.id)}
          canUnplug={canUnplug}
          onUnplug={() => {
            dispatch({ type: 'unplugCopy', copyId: selectedCopy.id })
            setSelectedCopyId(undefined)
          }}
          onClose={() => setSelectedCopyId(undefined)}
        />
      )}
    </div>
  )
}
