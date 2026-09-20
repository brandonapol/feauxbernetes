import type { TestSuite } from '../engine/ci'

/**
 * End-to-end suites keyed by app. GitNub looks these up via `GameConfig.testSuites` when it
 * opens a PR (#15). The CI engine fixture `engine/ci/__fixtures__/webE2eSuite.ts` is a copy of
 * `web` used by engine unit tests, which cannot import content.
 */

export const WEB_SUITE: TestSuite = [
  {
    name: 'A visitor can open the home page',
    durationMs: 800,
    steps: ['Opened inkwell.example', 'Waited for the page to say "Welcome to Inkwell"'],
  },
  {
    name: 'A visitor can search for "novel templates"',
    durationMs: 1200,
    steps: [
      'Opened inkwell.example',
      'Typed "novel templates" into Search',
      'Waited for the results list',
    ],
  },
  {
    name: 'A new visitor can sign up',
    durationMs: 10_400,
    steps: [
      'Opened inkwell.example/signup',
      'Typed "sam@example.com" into Email',
      'Clicked the "Create account" button',
      'Waited for the page to say "Welcome!"',
    ],
    failure: {
      flag: 'signupRejectsDotInEmail',
      observed: 'Something went wrong (500)',
      likelyCause:
        'web/signup.ts, line 42 — the new email check turns away any address with a dot in it.',
    },
  },
  {
    name: 'A member can log in',
    durationMs: 900,
    steps: [
      'Opened inkwell.example/login',
      'Typed valid credentials',
      'Waited for the account page',
    ],
  },
]

export const BILLING_SUITE: TestSuite = [
  {
    name: 'A visitor can open the pricing page',
    durationMs: 700,
    steps: ['Opened inkwell.example/pricing', 'Waited for the plans to load'],
  },
  {
    name: 'Checkout with a coupon totals $9.00',
    durationMs: 2400,
    steps: [
      'Opened the checkout page',
      'Typed "SAVE10" into Coupon',
      'Clicked Apply',
      'Waited for the total to say "$9.00"',
      'Clicked Pay',
      'Waited for the page to say "Thanks!"',
    ],
    failure: {
      flag: 'couponDoubleDiscount',
      observed: '-$1.00',
      expected: '$9.00',
      likelyCause:
        'billing/coupon.ts — the discount is applied twice, so a $10 plan with 10% off becomes -$1.00.',
    },
  },
]

export const TEST_SUITES: Record<string, TestSuite> = {
  web: WEB_SUITE,
  billing: BILLING_SUITE,
}
