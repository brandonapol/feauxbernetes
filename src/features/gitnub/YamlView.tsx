import { yamlLines, type Wish } from '../../engine/gitops'
import styles from './GitNub.module.css'

/**
 * Read-only YAML for a wish, with each line paired to its English sentence on hover *and* focus
 * (planning.md → Ch 2 / GitNub "View as YAML"). Caption lives with the caller.
 */
export function YamlView({ wish }: { wish: Wish }) {
  return (
    <ol className={styles.yamlList}>
      {yamlLines(wish).map((line) => (
        <li key={line.yaml}>
          <button type="button" className={styles.yamlLine} title={line.english}>
            <code>{line.yaml}</code>
            <span className={styles.yamlEnglish}>{line.english}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
