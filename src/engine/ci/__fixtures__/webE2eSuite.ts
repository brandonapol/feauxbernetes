import type { TestSuite } from '../types'

/**
 * The Ch 5 `web` end-to-end suite: Alex's PR adds a sign-up email check that rejects any address
 * with a dot before the "@". Matches `web@1.9`'s behaviour flag in `src/content/world.ts`
 * (`signupRejectsDotInEmail`) so this fixture stays honest about the scenario it's standing in
 * for, even though this engine never imports content or gitops directly.
 */
export const WEB_E2E_SUITE: TestSuite = [
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

/** `web@1.9`'s behaviour, matching `VERSION_BEHAVIOUR` in `src/content/world.ts`. */
export const SIGNUP_BUG_BEHAVIOUR: Record<string, unknown> = { signupRejectsDotInEmail: true }
