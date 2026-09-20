import type { Copy } from '../../engine/cluster'
import styles from './AppView.module.css'

/**
 * Narrates a rolling version swap (#16): new-version copies appear one at a time, old ones fade
 * out. Hidden when every running copy is already on the wished version.
 */
export function DeployCaption({
  copies,
  wishedVersion,
  wishedCopies,
}: {
  copies: Copy[]
  wishedVersion: string | undefined
  wishedCopies: number
}) {
  if (!wishedVersion) return null
  const live = copies.filter((copy) => copy.state !== 'Stopping' && copy.state !== 'Crashed')
  const onNew = live.filter((copy) => copy.version === wishedVersion)
  const onOld = live.filter((copy) => copy.version !== wishedVersion)
  if (onOld.length === 0 && onNew.length === wishedCopies) return null
  if (onOld.length === 0 && onNew.length === 0) return null
  if (live.every((copy) => copy.version === wishedVersion) && onNew.length < wishedCopies) {
    return (
      <p className={styles.caption} role="status">
        Starting extra copies of {wishedVersion}. {onNew.length} of {wishedCopies} up.
      </p>
    )
  }
  if (onOld.length === 0) return null
  const swapped = onNew.filter((copy) => copy.state === 'Running').length
  return (
    <p className={styles.caption} role="status">
      {swapped > 0
        ? `Copy ${swapped} of ${wishedCopies} is now on ${wishedVersion}. The old one is shutting down. ${swapped} of ${wishedCopies} swapped.`
        : `Starting ${wishedVersion}. None of the ${wishedCopies} copies have swapped yet.`}
    </p>
  )
}
