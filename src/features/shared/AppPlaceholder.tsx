import styles from './AppPlaceholder.module.css'

/**
 * The look every fake-browser tab (and the Instructions/Ops Console slots) shares until its own
 * ticket replaces it. Deliberately plain — a heading, one line about what's coming, and the
 * tracking issue — so nobody mistakes it for real content.
 */
export function AppPlaceholder({
  title,
  issue,
  note,
}: {
  title: string
  /** The ticket that replaces this placeholder, e.g. "#12". */
  issue: string
  note: string
}) {
  return (
    <div className={styles.placeholder}>
      <h2>{title}</h2>
      <p>{note}</p>
      <p className={styles.issue}>Lands in {issue}.</p>
    </div>
  )
}
