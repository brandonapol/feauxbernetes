import type { Action } from '../engine/game'

export interface FixDiffLine {
  text: string
  tone: 'added' | 'removed' | 'context'
  note?: string
}

/**
 * One option on GitNub's "Suggest a fix" panel (Ch 5, Ch 10). The panel looks up options by the
 * behaviour flag that made the e2e job fail. `veto` options explain why not and dispatch nothing;
 * the others dispatch a `suggestFix` action.
 */
export interface SuggestFixOption {
  id: string
  label: string
  explanation: string
  diff?: FixDiffLine[]
  veto?: string
  action?: Extract<Action, { type: 'suggestFix' }>
}

export const SUGGEST_FIXES: Record<string, SuggestFixOption[]> = {
  signupRejectsDotInEmail: [
    {
      id: 'delete-test',
      label: 'Delete the failing test',
      explanation: 'Remove "A new visitor can sign up" so the checks go green.',
      veto: "That's the worst option. The test is telling us something real: a visitor with a dot in their email can't sign up. Deleting it doesn't fix the bug, it just hides it.",
    },
    {
      id: 'skip-test',
      label: "Mark the test as 'skip for now'",
      explanation: 'The check goes yellow. The PR can merge, but the debt stays visible.',
      action: {
        type: 'suggestFix',
        prId: '',
        fix: 'skip-test',
        testName: 'A new visitor can sign up',
      },
    },
    {
      id: 'fix-code',
      label: 'Fix the email check',
      explanation: 'Allow dots in the local part of an email address, the way the real spec does.',
      diff: [
        { text: 'function isValidEmail(value) {', tone: 'context' },
        {
          text: '-  return /^[a-z]+@[a-z.]+$/.test(value)',
          tone: 'removed',
          note: 'This pattern rejects any address with a dot before the @.',
        },
        {
          text: '+  return /^[^@]+@[^@]+$/.test(value)',
          tone: 'added',
          note: 'A name can have a dot. sam.wilson@example.com is a real address.',
        },
        { text: '}', tone: 'context' },
      ],
      action: { type: 'suggestFix', prId: '', fix: 'fix-code' },
    },
  ],
  couponDoubleDiscount: [
    {
      id: 'delete-test',
      label: 'Delete the failing test',
      explanation: 'Remove the coupon checkout test so the checks go green.',
      veto: 'The test is the only thing that noticed the coupon was applied twice. Deleting it would ship the same outage again.',
    },
    {
      id: 'skip-test',
      label: "Mark the test as 'skip for now'",
      explanation: 'The check goes yellow. The debt stays visible, and so does the bug.',
      action: {
        type: 'suggestFix',
        prId: '',
        fix: 'skip-test',
        testName: 'Checkout with a coupon totals $9.00',
      },
    },
    {
      id: 'fix-code',
      label: 'Apply the coupon once',
      explanation: 'Stop multiplying the discount a second time at checkout.',
      diff: [
        { text: 'function applyCoupon(total, coupon) {', tone: 'context' },
        {
          text: '-  return total - coupon.amount - coupon.amount',
          tone: 'removed',
          note: 'The discount is subtracted twice.',
        },
        {
          text: '+  return total - coupon.amount',
          tone: 'added',
          note: 'Once is enough. $10 with 10% off is $9.00.',
        },
        { text: '}', tone: 'context' },
      ],
      action: { type: 'suggestFix', prId: '', fix: 'fix-code' },
    },
  ],
}

/** Options for a pipeline whose behaviour flags tripped a failure, if any. */
export function suggestFixesFor(
  behaviour: Record<string, unknown>
): SuggestFixOption[] | undefined {
  for (const [flag, options] of Object.entries(SUGGEST_FIXES)) {
    if (behaviour[flag]) return options
  }
  return undefined
}
