import { Navigate, Route, Routes } from 'react-router'

import { AppView } from './AppView'
import { Applications } from './Applications'
import { ArghCdNav } from './ArghCdNav'
import styles from './ArghCd.module.css'
import { BoxesView } from './BoxesView'
import { DatabaseView } from './DatabaseView'

/**
 * Argh CD: the window onto the cluster (planning.md → "Argh CD, part 1"). There's no separate
 * cluster-map tab — Applications (with the app view and the database tile it drills into) and
 * Boxes are the whole thing. Part 2 (#16) adds GitOps sync status on top of these same routes.
 */
export function ArghCd() {
  return (
    <div className={styles.arghCd}>
      <ArghCdNav />
      <div className={styles.content}>
        <Routes>
          {/* Absolute targets only: a relative "applications" from the `*` route below resolves
              against the unmatched path itself, which never matches anything either — an
              infinite redirect. */}
          <Route index element={<Navigate to="/argh-cd/applications" replace />} />
          <Route path="applications" element={<Applications />} />
          <Route path="app/:app" element={<AppView />} />
          <Route path="boxes" element={<BoxesView />} />
          <Route path="database" element={<DatabaseView />} />
          <Route path="*" element={<Navigate to="/argh-cd/applications" replace />} />
        </Routes>
      </div>
    </div>
  )
}
