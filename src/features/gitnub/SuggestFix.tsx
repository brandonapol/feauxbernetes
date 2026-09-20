import { useState } from 'react'

import { suggestFixesFor, type SuggestFixOption } from '../../content'
import type { Pipeline } from '../../engine/ci'
import { useDispatch } from '../../store'
import styles from './GitNub.module.css'

export function SuggestFix({ prId, pipeline }: { prId: string; pipeline: Pipeline }) {
  const dispatch = useDispatch()
  const options = suggestFixesFor(pipeline.behaviour)
  const [picked, setPicked] = useState<string>()
  const [veto, setVeto] = useState<string>()
  if (!options) return null

  const apply = (option: SuggestFixOption) => {
    setPicked(option.id)
    if (option.veto) {
      setVeto(option.veto)
      dispatch({
        type: 'applyEffect',
        effect: { type: 'flackMessage', channel: 'platform', from: 'kai', text: option.veto },
      })
      return
    }
    setVeto(undefined)
    if (!option.action) return
    dispatch({ ...option.action, prId })
  }

  return (
    <section className={styles.suggestFix} aria-label="Suggest a fix">
      <h3 className={styles.sectionTitle}>Suggest a fix</h3>
      <p className={styles.muted}>
        Three options. Each one teaches something; only one actually fixes it.
      </p>
      <ul className={styles.fixList}>
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className={styles.fixCard}
              data-target={`pr:${prId}:fix:${option.action?.fix ?? option.id}`}
              aria-pressed={picked === option.id}
              onClick={() => apply(option)}
            >
              <strong>{option.label}</strong>
              <span>{option.explanation}</span>
            </button>
            {picked === option.id && option.diff && (
              <pre className={styles.fixDiff}>
                {option.diff.map((line, index) => (
                  <span key={index} data-tone={line.tone}>
                    {line.text}
                    {line.note ? `\n    ${line.note}` : ''}
                    {'\n'}
                  </span>
                ))}
              </pre>
            )}
          </li>
        ))}
      </ul>
      {veto && (
        <p className={styles.kaiNote} role="status">
          <strong>Kai:</strong> {veto}
        </p>
      )}
    </section>
  )
}
