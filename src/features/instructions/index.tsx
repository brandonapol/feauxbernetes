import { AppPlaceholder } from '../shared/AppPlaceholder'

/**
 * Placeholder for the Instructions column. The chapter checklist, hints, Show me, glossary
 * tooltips, the on-call brain and the "Where is my change?" strip all land in #11. #5 only needs a
 * real slot here so the three-column layout is real; #11 replaces this wholesale.
 */
export function Instructions() {
  return (
    <AppPlaceholder
      title="Instructions"
      issue="#11"
      note="The chapter checklist, hints, Show me, and the on-call brain."
    />
  )
}
