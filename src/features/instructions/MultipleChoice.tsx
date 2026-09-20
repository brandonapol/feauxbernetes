import type { ChooseOptionChoice } from '../../engine/story/types'
import { useDispatch } from '../../store'
import { Markdown } from '../shared/Markdown'
import styles from './Instructions.module.css'

interface MultipleChoiceProps {
  stepId: string
  options: ChooseOptionChoice[]
  interpolate: (text: string) => string
}

/**
 * Radio cards for a `chooseOption` step whose choice belongs in the Instructions panel
 * (planning.md → "Multiple-choice rendering", `Step.options`). Picking one dispatches
 * `chooseOption`; a wrong pick's response (`Step.wrongAnswers`) is shown by the caller, from
 * `GameState.story.lastWrongAnswer`, since that's computed by the engine either way a choice is
 * made — here or in a step whose options live in the Ops Console instead.
 *
 * Each card carries the `data-target` "Show me" convention (`option:<stepId>:<optionId>`, see
 * `showMe.ts`), so the correct one can be highlighted the same way any other panel's choice can.
 */
export function MultipleChoice({ stepId, options, interpolate }: MultipleChoiceProps) {
  const dispatch = useDispatch()
  return (
    <fieldset className={styles.options}>
      <legend className={styles.srOnly}>Choose one</legend>
      {options.map((option) => (
        <label
          key={option.id}
          className={styles.optionCard}
          data-target={`option:${stepId}:${option.id}`}
        >
          <input
            type="radio"
            name={`option-${stepId}`}
            value={option.id}
            onChange={() => dispatch({ type: 'chooseOption', stepId, optionId: option.id })}
          />
          <Markdown source={interpolate(option.label)} inline />
        </label>
      ))}
    </fieldset>
  )
}
