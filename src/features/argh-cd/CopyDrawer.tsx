import { useEffect, useRef } from 'react'

import type { Copy } from '../../engine/cluster'
import { useRestoreFocus } from '../shared/useRestoreFocus'
import { COPY_STATE_DISPLAY } from './display'
import styles from './CopyDrawer.module.css'
import { upForText } from './duration'

/**
 * The small drawer a copy opens: app, version, box, how long it's been up, restarts, its last few
 * English log lines, and "Unplug this copy" — only once `canUnplug` says a chapter has unlocked
 * it. See planning.md → "Argh CD, part 1".
 */
export function CopyDrawer({
  copy,
  boxName,
  now,
  logLines,
  canUnplug,
  onUnplug,
  onClose,
}: {
  copy: Copy
  boxName: string
  now: number
  logLines: string[]
  canUnplug: boolean
  onUnplug: () => void
  onClose: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const display = COPY_STATE_DISPLAY[copy.state]

  useRestoreFocus()
  useEffect(() => heading.current?.focus(), [])

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-drawer-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <div className={styles.header}>
          <h2 id="copy-drawer-title" tabIndex={-1} ref={heading} className={styles.title}>
            {copy.app} copy
          </h2>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </div>

        <p className={styles.state}>
          <span aria-hidden="true">{display.icon}</span> {display.label}
        </p>

        <dl className={styles.facts}>
          <div>
            <dt>App</dt>
            <dd>{copy.app}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{copy.version}</dd>
          </div>
          <div>
            <dt>Box</dt>
            <dd>{boxName}</dd>
          </div>
          <div>
            <dt>Up for</dt>
            <dd>{upForText(copy.startedAt, now)}</dd>
          </div>
          <div>
            <dt>Restarts</dt>
            <dd>{copy.restarts}</dd>
          </div>
        </dl>

        <h3 className={styles.logHeading}>Recent activity</h3>
        {logLines.length > 0 ? (
          <ul className={styles.log}>
            {logLines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.log}>Nothing to report — this copy has been quiet.</p>
        )}

        {canUnplug && (
          <button
            type="button"
            className={styles.unplug}
            data-target={`copy:${copy.id}`}
            onClick={onUnplug}
          >
            Unplug this copy
          </button>
        )}
      </div>
    </div>
  )
}
