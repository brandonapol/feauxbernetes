import type { Chapter } from '../../engine/story/types'
import { startingWorld } from './helpers'

export const sloChapter: Chapter = {
  id: 'ch7-slo',
  title: 'How good is good enough?',
  milestone: 'm2',
  intro:
    '“Is it working?” is a number the team agreed on, not a vibe. You’ll pick an SLI, a target, and what to do when the error budget is low.',
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
      id: 'choose-sli',
      title: 'Choose an SLI',
      body: 'Which number best tells us whether **checkout** is working for customers?',
      hints: ['Customers don’t feel CPU. They feel whether they can pay.'],
      options: [
        { id: 'cpu', label: 'CPU usage on the billing boxes.' },
        { id: 'copies', label: 'How many copies of billing are running.' },
        {
          id: 'checkout',
          label: 'Percent of checkouts that succeed within 2 seconds.',
        },
        { id: 'tickets', label: 'Number of support tickets this week.' },
      ],
      solution: { type: 'chooseOption', stepId: 'choose-sli', optionId: 'checkout' },
      goal: (_state, event) =>
        event.type === 'optionChosen' &&
        event.stepId === 'choose-sli' &&
        event.optionId === 'checkout',
      wrongAnswers: {
        cpu: 'Kai: "Customers don’t feel CPU. A box can be busy and checkout still works — or idle and checkout is on fire."',
        copies: 'Kai: "Three healthy copies of a broken version still fail checkout. Copies are capacity, not success."',
        tickets:
          'Kai: "Tickets lag. By the time support hears it, the budget is already spent. Use the checkout itself."',
      },
    },
    {
      id: 'choose-target',
      title: 'Choose a target',
      body: 'What SLO should we promise for that SLI?',
      hints: ['100% freezes the company. 99.9% is the usual starting point.'],
      options: [
        { id: 'hundred', label: '100% — we never fail a checkout.' },
        { id: 'four-nines', label: '99.99% — about 4 minutes of full outage a month.' },
        { id: 'three-nines', label: '99.9% — about 43 minutes of full outage a month.' },
        { id: 'two-nines', label: '99% — about 7 hours of full outage a month.' },
      ],
      solution: { type: 'chooseOption', stepId: 'choose-target', optionId: 'three-nines' },
      goal: (_state, event) =>
        event.type === 'optionChosen' &&
        event.stepId === 'choose-target' &&
        event.optionId === 'three-nines',
      wrongAnswers: {
        hundred:
          'Kai: "100% is impossible. Chasing it freezes launches. Some failure is budgeted for — that’s the whole idea."',
        'four-nines':
          'Kai: "That’s a fine later target, but it’s expensive. We start at 99.9% until we know the cost."',
        'two-nines':
          'Kai: "Seven hours a month of checkout down is a lot of angry mail. We can do better than 99%."',
      },
    },
    {
      id: 'budget-policy',
      title: 'When the tank is low',
      body: 'The error budget is a fuel gauge. Past incidents drain it. The team’s policy is to pause risky launches when the tank is low. The budget is almost empty. What should we do?',
      hints: ['Protect the remaining budget. Don’t ship a risky change.'],
      thinking: 'Budget low means we already spent our allowed failures. More risk now is how you get a worse week.',
      options: [
        { id: 'ship', label: 'Ship Alex’s big refactor anyway — we need the features.' },
        { id: 'pause', label: 'Pause risky launches until the budget recovers.' },
        { id: 'raise', label: 'Raise the SLO to 100% so the gauge looks full again.' },
      ],
      solution: { type: 'chooseOption', stepId: 'budget-policy', optionId: 'pause' },
      goal: (_state, event) =>
        event.type === 'optionChosen' &&
        event.stepId === 'budget-policy' &&
        event.optionId === 'pause',
      wrongAnswers: {
        ship: 'Kai: "That’s how a bad week becomes a worse month. The budget is the agreement that we slow down when customers have already been hurt."',
        raise:
          'Kai: "Changing the target to hide spend is cheating. The number has to mean something or nobody trusts it."',
      },
    },
  ],
  mentorQuestions: ['slo-vs-sla'],
  summary: [
    'An SLI is a customer-facing number. CPU is not one.',
    'An SLO is a target plus a window. 100% is a trap.',
    'The error budget is how much failure we already agreed to. When it’s low, we pause risk.',
  ],
}
