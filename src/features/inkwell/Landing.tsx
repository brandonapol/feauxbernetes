import { Link } from 'react-router'

import styles from './Landing.module.css'

/** inkwell.example's home page. See planning.md → "inkwell.example" and #17. */
export function Landing() {
  return (
    <div className={styles.hero}>
      <h1>Write without friction.</h1>
      <p>
        Inkwell is where writers draft, organize and publish — from a first paragraph to a finished
        manuscript, without fighting the tool.
      </p>
      <div className={styles.actions}>
        <Link to="/inkwell/signup" className={styles.primary}>
          Start writing free
        </Link>
        <Link to="/inkwell/pricing" className={styles.secondary}>
          See pricing
        </Link>
      </div>
      <div className={styles.features}>
        <div className={styles.feature}>
          <h2>Your whole draft, always</h2>
          <p>Every document, versioned and backed up automatically.</p>
        </div>
        <div className={styles.feature}>
          <h2>Find anything instantly</h2>
          <p>Full-text search across every project you've ever started.</p>
        </div>
        <div className={styles.feature}>
          <h2>One plan, everything included</h2>
          <p>No feature gates. Just Inkwell Pro, billed monthly.</p>
        </div>
      </div>
    </div>
  )
}
