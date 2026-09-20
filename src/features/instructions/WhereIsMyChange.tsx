import { useState } from 'react'

import { useGame } from '../../store'
import styles from './WhereIsMyChange.module.css'
import {
  activeChange,
  boxState,
  checksSummary,
  describeActiveChange,
  STRIP_BOXES,
} from './whereIsMyChange'

const MARK: Record<string, string> = { done: '✔', failed: '✕', current: '▶', todo: '○' }

/**
 * "Where is my change?" (planning.md → "Instructions (#11)"), the successor to Flack's "Where are
 * my changes?": PR → checks → merged → Argh CD → running, highlighting the learner's change as it
 * moves. Reads `GameState.gitops` and `.ci` directly (see `whereIsMyChange.ts`) — real engine
 * state (#7, #8), wired into `GameState` by this ticket. It only appears once there's a change to
 * show: before #15 (GitNub) wires up opening a PR, `gitops.pullRequests` is always empty, so
 * nothing renders — the same "nothing to show yet" convention Flack's `WhereAreMyChanges` uses.
 */
export function WhereIsMyChange() {
  const gitops = useGame((s) => s.game.gitops)
  const cluster = useGame((s) => s.game.cluster)
  const ci = useGame((s) => s.game.ci)
  const [open, setOpen] = useState(true)

  const change = activeChange(gitops, cluster)
  if (!change) return null

  const checks = checksSummary(ci, change.pr)

  return (
    <section className={styles.panel} aria-labelledby="where-is-my-change-title">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>{' '}
        <span id="where-is-my-change-title">Where is my change?</span>
      </button>
      <p className={styles.srOnly} aria-live="polite">
        {describeActiveChange(change)}
      </p>
      {open && (
        <ol className={styles.stages}>
          {STRIP_BOXES.map((box, index) => {
            const state = boxState(change, index)
            return (
              <li key={box.id} className={styles.stage} data-state={state}>
                <span className={styles.stageMark} aria-hidden="true">
                  {MARK[state]}
                </span>
                <span className={styles.stageLabel}>
                  {box.label}
                  {box.id === 'checks' && checks && state !== 'todo' && (
                    <span className={styles.stageDetail}> — {checks}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
