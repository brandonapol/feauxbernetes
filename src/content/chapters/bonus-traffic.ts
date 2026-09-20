import { DEPLOY_REPO } from '../../engine/gitops'
import type { Chapter } from '../../engine/story/types'
import { startingWorld } from './helpers'

export const trafficSpikeChapter: Chapter = {
  id: 'bonus-traffic',
  title: 'Traffic spike',
  milestone: 'bonus',
  intro:
    'A marketing email just doubled traffic to web. This is a ticket, not a page — Ch 8 still holds. You’ll scale up the same way you shipped 2.0: a wish in GitNub.',
  setup: (state) => {
    const world = startingWorld(state)
    return {
      ...world,
      ui: {
        ...world.ui,
        activeTab: 'grafauxna',
        unlockedTabs: ['flack', 'inkwell', 'arghcd', 'gitnub', 'grafauxna'],
        gitOpsEnforced: true,
      },
      flack: { ...world.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'not-a-page',
      title: 'Page or ticket?',
      body: 'Latency is up. Errors are not. Do we wake someone at 3am?',
      hints: ['Ch 8: a page has to earn 3am. Latency without errors is a ticket.'],
      options: [
        { id: 'page', label: 'Page — wake the on-call.' },
        { id: 'ticket', label: 'Ticket — look at it this morning and add copies.' },
      ],
      solution: { type: 'chooseOption', stepId: 'not-a-page', optionId: 'ticket' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'not-a-page' && event.optionId === 'ticket',
      wrongAnswers: {
        page: 'Kai: "Errors are fine. Customers are slower, not broken. That’s a ticket. We add copies after coffee."',
      },
    },
    {
      id: 'scale-web',
      title: 'Ask GitNub for more copies',
      body: 'In the wish editor, set **web** to **6 copies** and propose + merge. Same loop as Ch 4.',
      hints: ['GitNub → deploy → web copies stepper.'],
      solution: {
        type: 'openPR',
        repo: DEPLOY_REPO,
        title: 'Scale web to 6 copies',
        change: { kind: 'wish', app: 'web', wish: { app: 'web', version: '1.8', copies: 6 } },
        reviewers: ['kai'],
      },
      goal: (_state, event) => event.type === 'prOpened',
    },
    {
      id: 'merge-scale',
      title: 'Merge it',
      body: 'Approve if needed, then **Merge**. Argh CD will add copies. Latency comes back down.',
      hints: ['Merge is at the bottom of the pull request.'],
      solution: { type: 'mergePR', prId: 'latest' },
      goal: (_state, event) => event.type === 'prMerged',
      afterNote: 'You just scaled by changing the wish. Same as shipping a version.',
    },
    {
      id: 'autoscaling',
      title: 'A wish about wishes',
      body: 'Kai: “Autoscaling is a wish about wishes: keep the boxes about 60% busy by adding or removing copies.” Turn it on?',
      hints: ['The point is the idea, not a new control panel.'],
      options: [
        { id: 'on', label: 'Turn it on — let the wish keep the wish true.' },
        { id: 'off', label: 'Leave it off — I want to scale by hand forever.' },
      ],
      solution: { type: 'chooseOption', stepId: 'autoscaling', optionId: 'on' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'autoscaling' && event.optionId === 'on',
      wrongAnswers: {
        off: 'Kai: "You can, and we did, just now. Autoscaling is the same trick on a loop so the next email doesn’t need a human."',
      },
    },
  ],
  mentorQuestions: ['slo-vs-sla'],
  summary: [
    'A traffic spike without errors is a ticket, not a page.',
    'Scaling is a wish: more copies, merge, Argh CD makes it true.',
    'Autoscaling is a wish about wishes: keep the boxes about 60% busy.',
  ],
}
