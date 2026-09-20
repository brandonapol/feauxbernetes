import type { Chapter } from '../../engine/story/types'
import styles from './Instructions.module.css'
import { isLearnerOnCall } from './onCallBrain'

interface ThinkingCalloutProps {
  stepId: string
  text: string
  chapter: Chapter
}

/**
 * The on-call brain (planning.md → "The On-call brain"): an SRE's internal monologue, shown as a
 * thought-bubble callout above the step text. First person, present tense, written by content —
 * this component only ever displays it.
 *
 * `key={stepId}` forces React to tear down and rebuild the `aria-live` region on every step
 * change, which is what makes assistive tech announce the *new* thinking rather than staying
 * silent because "the region already said something." `aria-live="polite"` (not `assertive`) so it
 * doesn't interrupt whatever the learner's screen reader is already reading.
 */
export function ThinkingCallout({ stepId, text, chapter }: ThinkingCalloutProps) {
  const label = isLearnerOnCall(chapter) ? "What you're thinking" : "What Kai's thinking"
  return (
    <div key={stepId} className={styles.thinking} aria-live="polite">
      <p className={styles.thinkingLabel}>
        <span aria-hidden="true">💭 </span>
        {label}
      </p>
      <p className={styles.thinkingText}>{text}</p>
    </div>
  )
}
