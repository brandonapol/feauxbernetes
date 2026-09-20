import type { Action } from '../../engine/game'

/**
 * The `data-target` convention (issue #11): "Show me" finds the element for a step's `solution`
 * by a `data-target` attribute, computed here from the action alone. Any panel that renders a
 * clickable goal — the Ops Console's wishes and unplug/box buttons (#13), GitNub's tabs and PR
 * actions (#15), Argh CD's copies (#14/#16), Flack's channels and quick replies (#12) — sets this
 * attribute on its own elements so "Show me" (and the golden-path harness, eventually) can find
 * them without knowing which panel they live in. When the panel renders the choice itself (a
 * `chooseOption` step with `Step.options`), the Instructions panel sets the same attribute on its
 * own radio cards, so the convention is exercised end to end even before another panel exists.
 *
 * Not every action names a single clickable element (`setPlayerName` types into a field; most
 * story/effect/clock actions aren't learner goals at all) — those return `undefined`, and the step
 * simply has no "Show me" button.
 */
export function targetIdFor(action: Action): string | undefined {
  switch (action.type) {
    case 'clickTarget':
      return action.targetId
    case 'openTab':
      return `tab:${action.tab}`
    case 'openOverlay':
      return `overlay:${action.overlay}`
    case 'closeOverlay':
      return 'close-overlay'
    case 'chooseOption':
      return `option:${action.stepId}:${action.optionId}`
    case 'openChannel':
      return `channel:${action.channel}`
    case 'flackReply':
      return `reply:${action.messageId}:${action.replyId}`
    case 'chooseWish':
      return `wish:${action.app}`
    case 'unplugCopy':
      return `copy:${action.copyId}`
    case 'setBox':
      return `box:${action.boxId}`
    default:
      return undefined
  }
}

/**
 * A one-line, human-readable description of a step's `solution`, for the "Do this:" reveal.
 * Content never writes this text itself — every step's `body`/`hints` already say what to do in
 * the story's own words, so this is only a plain, generic fallback for the exact click.
 */
export function describeSolution(action: Action): string {
  switch (action.type) {
    case 'clickTarget':
      return 'Click the highlighted element.'
    case 'openTab':
      return `Open the ${action.tab} tab.`
    case 'openOverlay':
      return 'Open the highlighted overlay.'
    case 'closeOverlay':
      return 'Close the overlay.'
    case 'chooseOption':
      return 'Choose the highlighted option.'
    case 'openChannel':
      return `Open the ${action.channel} channel.`
    case 'flackReply':
      return 'Send the highlighted reply.'
    case 'chooseWish':
      return `Ask for ${action.copies} ${action.copies === 1 ? 'copy' : 'copies'} of ${action.app}@${action.version}.`
    case 'unplugCopy':
      return 'Unplug the highlighted copy.'
    case 'setBox':
      return `Turn box ${action.boxId} ${action.on ? 'on' : 'off'}.`
    case 'setPlayerName':
      return 'Type your name.'
    default:
      return 'Do the highlighted thing.'
  }
}

/** How long the highlight (and the temporary focusability of a non-interactive target) lasts. */
export const SHOW_ME_HIGHLIGHT_MS = 4000

const NATIVELY_FOCUSABLE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'])

function isFocusable(element: HTMLElement): boolean {
  return NATIVELY_FOCUSABLE.has(element.tagName) || element.hasAttribute('tabindex')
}

/** The element carrying `data-target="<targetId>"`, if the panel that owns it has rendered yet. */
export function findShowMeTarget(targetId: string): HTMLElement | undefined {
  for (const element of document.querySelectorAll<HTMLElement>('[data-target]')) {
    if (element.dataset.target === targetId) return element
  }
  return undefined
}

/**
 * Scrolls the target into view, marks it with `data-show-me` (for a CSS attention ring) and
 * focuses it — adding a temporary `tabindex` first when it isn't natively focusable, so screen
 * reader and keyboard users land exactly where a mouse user's eye would go. Both are removed after
 * `durationMs`. Returns whether a target was found at all: nothing else the caller can do about a
 * `data-target` that hasn't landed yet, but it's worth knowing in a test.
 */
export function showMe(targetId: string, durationMs = SHOW_ME_HIGHLIGHT_MS): boolean {
  const target = findShowMeTarget(targetId)
  if (!target) return false

  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  target.setAttribute('data-show-me', 'true')
  const addedTabIndex = !isFocusable(target)
  if (addedTabIndex) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })

  window.setTimeout(() => {
    target.removeAttribute('data-show-me')
    if (addedTabIndex) target.removeAttribute('tabindex')
  }, durationMs)

  return true
}
