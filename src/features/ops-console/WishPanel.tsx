import { useState, type ReactNode } from 'react'

import { currentStep } from '../../engine/story'
import type { WishOption } from '../../engine/story/types'
import { useDispatch, useGame } from '../../store'
import styles from './WishPanel.module.css'

/** Renders `` `backtick` `` spans as `<code>`, the same convention step body text uses. */
function renderLabel(text: string): ReactNode {
  return text
    .split(/(`[^`]+`)/g)
    .filter((part) => part !== '')
    .map((part, index) =>
      part.startsWith('`') && part.endsWith('`') ? (
        <code key={index}>{part.slice(1, -1)}</code>
      ) : (
        <span key={index}>{part}</span>
      )
    )
}

function RealLifeLines({ lines }: { lines: WishOption['kubectl'] }) {
  return (
    <ol className={styles.codeLines}>
      {lines.map((line, index) => (
        <li key={index}>
          <code>{line.code}</code>
          {line.note && <p className={styles.codeNote}>{line.note}</p>}
        </li>
      ))}
    </ol>
  )
}

function WishCard({
  option,
  selected,
  kaiNote,
  onSelect,
  onMakeItSo,
}: {
  option: WishOption
  selected: boolean
  /** Kai's response, shown only while this card is both selected and the one it answered. */
  kaiNote: string | undefined
  onSelect: () => void
  onMakeItSo: () => void
}) {
  const inputId = `ops-console-wish-${option.id}`
  return (
    <div className={styles.card}>
      <label className={styles.cardLabel} htmlFor={inputId}>
        <input
          type="radio"
          id={inputId}
          name="ops-console-wish"
          value={option.id}
          checked={selected}
          onChange={onSelect}
        />
        <span>{renderLabel(option.label)}</span>
      </label>
      {selected && (
        <div className={styles.cardDetails}>
          {option.preview && (
            <p className={styles.preview}>
              {option.preview.label}: {option.preview.from} → {option.preview.to}
            </p>
          )}
          <details className={styles.realLife}>
            <summary>In real life</summary>
            <RealLifeLines lines={option.kubectl} />
            {option.yaml && (
              <>
                <p className={styles.yamlLabel}>Or, as YAML:</p>
                <RealLifeLines lines={option.yaml} />
              </>
            )}
          </details>
          <button type="button" className={styles.makeItSo} onClick={onMakeItSo}>
            Make it so
          </button>
          {kaiNote && (
            <p className={styles.kaiNote} role="status">
              <strong>Kai:</strong> {kaiNote}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The "What do you want?" half of the Ops Console (#13): chapter-provided `WishOption`s
 * (`Step.wishOptions`) as radio cards. Selecting one reveals its before/after preview and "In real
 * life" disclosure; "Make it so" dispatches the wish, or — for a deliberately wrong option — shows
 * Kai's explanation instead and dispatches nothing to the cluster (see `WishOption` for the shape
 * chapter tickets author against).
 */
export function WishPanel() {
  const step = useGame((s) => currentStep(s.config, s.game))
  const activeChannel = useGame((s) => s.game.flack.activeChannel ?? s.config.defaultChannel)
  const dispatch = useDispatch()

  const [selectedId, setSelectedId] = useState<string>()
  const [kaiNote, setKaiNote] = useState<{ optionId: string; text: string }>()

  const options = step?.wishOptions ?? []

  const select = (id: string) => {
    setSelectedId(id)
    setKaiNote(undefined)
  }

  const makeItSo = (option: WishOption) => {
    if (option.veto) {
      setKaiNote({ optionId: option.id, text: option.veto })
      dispatch({
        type: 'applyEffect',
        effect: {
          type: 'flackMessage',
          channel: activeChannel ?? 'platform',
          from: 'kai',
          text: option.veto,
        },
      })
      return
    }
    setKaiNote(undefined)
    if (option.action) dispatch(option.action)
  }

  return (
    <section className={styles.panel} aria-labelledby="ops-console-wishes-heading">
      <h2 id="ops-console-wishes-heading" className={styles.heading}>
        What do you want?
      </h2>
      {options.length === 0 ? (
        <p className={styles.empty}>Nothing to do here right now. Watch the feed.</p>
      ) : (
        <div role="radiogroup" aria-labelledby="ops-console-wishes-heading">
          {options.map((option) => (
            <WishCard
              key={option.id}
              option={option}
              selected={selectedId === option.id}
              kaiNote={kaiNote?.optionId === option.id ? kaiNote.text : undefined}
              onSelect={() => select(option.id)}
              onMakeItSo={() => makeItSo(option)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
