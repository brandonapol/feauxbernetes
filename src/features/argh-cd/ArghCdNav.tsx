import { Link, useLocation } from 'react-router'

import { useDispatch } from '../../store'
import styles from './ArghCdNav.module.css'

/**
 * Argh CD's own small nav: Applications (which also covers an app's own view and the database
 * tile) and Boxes. There's no separate cluster-map tab — this pair of views is the whole window
 * onto the cluster (planning.md → "Argh CD, part 1").
 */
export function ArghCdNav() {
  const { pathname } = useLocation()
  const dispatch = useDispatch()
  const onBoxes = pathname === '/argh-cd/boxes'

  return (
    <header className={styles.header}>
      <span className={styles.title}>Argh CD</span>
      <nav aria-label="Argh CD views" className={styles.nav}>
        <Link
          to="/argh-cd/applications"
          className={styles.link}
          aria-current={onBoxes ? undefined : 'page'}
          data-target="arghcd-applications"
          onClick={() => dispatch({ type: 'clickTarget', targetId: 'arghcd-applications' })}
        >
          Applications
        </Link>
        <Link
          to="/argh-cd/boxes"
          className={styles.link}
          aria-current={onBoxes ? 'page' : undefined}
          data-target="arghcd-boxes"
          onClick={() => dispatch({ type: 'clickTarget', targetId: 'arghcd-boxes' })}
        >
          Boxes
        </Link>
      </nav>
    </header>
  )
}
