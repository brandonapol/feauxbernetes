import { prCheckStatus, schedulePipeline } from '../../engine/ci'
import { WEB_SUITE } from '../testSuites'
import { openPR, setPRChecks } from '../../engine/gitops'
import type { Chapter } from '../../engine/story/types'
import { startingWorld } from './helpers'

const SIGNUP_BUG = { signupRejectsDotInEmail: true }

export const ciChapter: Chapter = {
  id: '05-ci',
  title: 'The robots check your work',
  milestone: 'm1',
  intro:
    'Alex opened a pull request on inkwell/web. The robots have opinions. Your job is to read them.',
  setup: (state) => {
    const world = startingWorld(state)
    const opened = openPR(
      world.gitops,
      {
        repo: 'inkwell/web',
        title: 'Stricter sign-up email check',
        author: 'alex',
        reviewers: ['kai'],
        change: {
          kind: 'version',
          app: 'web',
          version: {
            version: '1.9',
            author: 'alex',
            summary: 'Reject addresses that look fake.',
            behaviour: SIGNUP_BUG,
          },
        },
      },
      world.clock.now
    )
    const scheduled = schedulePipeline(
      world.ci,
      {
        prId: opened.pullRequest.id,
        service: 'web',
        suite: WEB_SUITE,
        behaviour: SIGNUP_BUG,
        buildDurationMs: 800,
        unitTestDurationMs: 1200,
      },
      world.clock.now
    )
    const gitops = setPRChecks(
      opened.gitops,
      opened.pullRequest.id,
      prCheckStatus(scheduled.pipeline),
      scheduled.pipeline.id
    )
    return {
      ...world,
      gitops,
      ci: scheduled.ci,
      ui: {
        ...world.ui,
        activeTab: 'gitnub',
        unlockedTabs: ['flack', 'inkwell', 'arghcd', 'gitnub'],
        gitOpsEnforced: true,
      },
      flack: { ...world.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'open-pr',
      title: 'Open Alex’s pull request',
      body: 'Open **GitNub**, then **inkwell/web**, then the open pull request. Build and unit tests are already green. End-to-end tests are waiting for you.',
      hints: ['GitNub → web → Pull requests.'],
      solution: { type: 'openTab', tab: 'gitnub' },
      goal: (state, event) =>
        (event.type === 'tabOpened' && event.tab === 'gitnub') || state.ui.activeTab === 'gitnub',
    },
    {
      id: 'run-e2e',
      title: 'Run the end-to-end tests',
      body: 'Click **▶ Run** on End-to-end tests. Four checks will tick. One will fail, in English.',
      hints: ['The Checks panel on the pull request. The job that still says waiting.'],
      solution: { type: 'runJob', pipelineId: 'latest', jobId: 'e2e' },
      goal: (_state, event) => event.type === 'jobRan',
      afterNote:
        'A visitor named sam.wilson@example.com couldn’t sign up. The new email check rejects any address with a dot in it.',
    },
    {
      id: 'suggest-fix',
      title: 'Fix the email check',
      body: 'Under **Suggest a fix**, don’t delete the test. Don’t skip it either — pick **Fix the email check**. Then run the tests again (the next step).',
      hints: ['Three cards under Suggest a fix. The one that changes the code.'],
      solution: { type: 'suggestFix', prId: 'latest', fix: 'fix-code' },
      goal: (_state, event) => event.type === 'fixSuggested' && event.fix === 'fix-code',
    },
    {
      id: 'run-again',
      title: 'Run the tests again',
      body: '▶ Run end-to-end tests once more. They should all pass. Then merge.',
      hints: ['Same Checks panel. The job is waiting again after the fix.'],
      solution: { type: 'runJob', pipelineId: 'latest', jobId: 'e2e' },
      goal: (_state, event) => event.type === 'jobRan',
    },
    {
      id: 'merge-fix',
      title: 'Merge it',
      body: 'Approve if needed, then **Merge**. The bug never reached customers. That’s the whole point of the robots.',
      hints: ['Merge is at the bottom of the pull request.'],
      solution: { type: 'mergePR', prId: 'latest' },
      goal: (_state, event) => event.type === 'prMerged',
    },
  ],
  mentorQuestions: ['why-not-restart'],
  summary: [
    'End-to-end tests click through the site the way a customer would, and fail in English.',
    'A failing test is a gift. Deleting it hides a real bug.',
    'The robots caught this before it reached anyone. That’s CI.',
  ],
}
