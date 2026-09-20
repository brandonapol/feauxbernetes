import { Link, Navigate, Route, Routes, useLocation } from 'react-router'

import { useDispatch } from '../../store'
import { Alerts } from './Alerts'
import { Dashboard } from './Dashboard'
import styles from './Grafauxna.module.css'
import { Logs } from './Logs'
import { Replay } from './Replay'
import { SloPanel } from './SloPanel'

/**
 * Grafauxna (#25): dashboards (golden signals), logs, SLOs, and alert rules. Charts always have a
 * text summary and a table toggle. The tab stays locked until Ch 6 unlocks it.
 */
export function Grafauxna() {
  const { pathname } = useLocation()
  const dispatch = useDispatch()
  return (
    <div className={styles.grafauxna}>
      <header className={styles.header}>
        <span className={styles.title}>Grafauxna</span>
        <nav className={styles.nav} aria-label="Grafauxna">
          <Link to="/grafauxna" aria-current={pathname === '/grafauxna' ? 'page' : undefined}>
            Dashboards
          </Link>
          <Link
            to="/grafauxna/logs"
            aria-current={pathname.startsWith('/grafauxna/logs') ? 'page' : undefined}
            data-target="grafauxna-logs"
            onClick={() => dispatch({ type: 'clickTarget', targetId: 'grafauxna-logs' })}
          >
            Logs
          </Link>
          <Link
            to="/grafauxna/slos"
            aria-current={pathname.startsWith('/grafauxna/slos') ? 'page' : undefined}
            data-target="grafauxna-slos"
            onClick={() => dispatch({ type: 'clickTarget', targetId: 'grafauxna-slos' })}
          >
            SLOs
          </Link>
          <Link
            to="/grafauxna/alerts"
            aria-current={pathname.startsWith('/grafauxna/alerts') ? 'page' : undefined}
          >
            Alerts
          </Link>
          <Link
            to="/grafauxna/replay"
            aria-current={pathname.startsWith('/grafauxna/replay') ? 'page' : undefined}
            data-target="grafauxna-replay"
            onClick={() => dispatch({ type: 'clickTarget', targetId: 'grafauxna-replay' })}
          >
            Replay
          </Link>
        </nav>
      </header>
      <div className={styles.content}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="logs" element={<Logs />} />
          <Route path="slos" element={<SloPanel />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="replay" element={<Replay />} />
          <Route path="*" element={<Navigate to="/grafauxna" replace />} />
        </Routes>
      </div>
    </div>
  )
}
