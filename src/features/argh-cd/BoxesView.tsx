import { useState } from 'react'

import { SERVICES } from '../../content'
import { useGame } from '../../store'
import styles from './BoxesView.module.css'
import { CopyChip } from './CopyChip'
import { ordinalFor } from './copyLabel'
import { CopyDrawer } from './CopyDrawer'
import { groupByBox } from './groupByBox'
import { copyLogLines } from './logLines'
import { boxesSummarySentence } from './summaries'
import { useAnimatedCopies } from './useAnimatedCopies'

/**
 * Every copy of every app, grouped by the box it's on — including a box that's off, so its copies
 * leaving (and reappearing elsewhere) is something the learner can watch. See planning.md → "Argh
 * CD, part 1".
 */
export function BoxesView() {
  const cluster = useGame((s) => s.game.cluster)
  const now = useGame((s) => s.game.clock.now)
  const clusterEvents = useGame((s) => s.game.clusterEvents)
  const canUnplug = useGame((s) => s.game.ui.canUnplugCopies)
  const dispatch = useGame((s) => s.dispatch)
  const [selectedCopyId, setSelectedCopyId] = useState<string>()

  const { entries } = useAnimatedCopies(cluster.copies)
  const allCopies = entries.map((entry) => entry.copy)
  const groups = groupByBox(entries, cluster.boxes)
  const selectedCopy = allCopies.find((copy) => copy.id === selectedCopyId)

  const appNames = new Set(SERVICES.map((service) => service.id))

  return (
    <div>
      <h1 className={styles.heading}>Boxes</h1>
      <p className={styles.summary}>{boxesSummarySentence(cluster)}</p>

      {groups.map(({ box, entries: boxEntries }) => (
        <section key={box.id} className={styles.boxGroup} data-off={!box.on || undefined}>
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
              {boxEntries.map(({ copy, leaving }) => {
                const sameApp = allCopies.filter(
                  (candidate) => candidate.app === copy.app && appNames.has(candidate.app)
                )
                const ordinal = ordinalFor(copy, sameApp)
                return (
                  <li key={copy.id}>
                    <CopyChip
                      copy={copy}
                      ordinal={ordinal}
                      visibleLabel={`${copy.app} ${ordinal}`}
                      boxName={box.name}
                      leaving={leaving}
                      selected={copy.id === selectedCopyId}
                      onSelect={() => setSelectedCopyId(copy.id)}
                    />
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className={styles.empty}>{box.on ? 'Nothing here right now.' : 'Off.'}</p>
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
