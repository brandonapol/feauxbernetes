import type { Chapter } from '../../engine/story/types'
import { startingWorld } from './helpers'

export const seeingInsideChapter: Chapter = {
  id: 'ch6-seeing-inside',
  title: 'Seeing inside',
  milestone: 'm2',
  intro:
    'You can watch copies start. Now you’ll watch *how the app feels* — latency, traffic, errors, saturation. Engineers call those the golden signals.',
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
      id: 'open-grafauxna',
      title: 'Open Grafauxna',
      body: 'Open the **Grafauxna** tab. Four charts: how slow, how busy, how many errors, how full. That’s the inside of the app.',
      hints: ['Grafauxna is now unlocked in the tab strip.'],
      solution: { type: 'openTab', tab: 'grafauxna' },
      goal: (state, event) =>
        (event.type === 'tabOpened' && event.tab === 'grafauxna') ||
        state.ui.activeTab === 'grafauxna',
      onEnter: [{ type: 'unlockTab', tab: 'grafauxna' }],
    },
    {
      id: 'name-signals',
      title: 'Name the four signals',
      body: 'Which set is the four golden signals?',
      hints: ['Latency, traffic, errors, saturation.'],
      options: [
        {
          id: 'cpu',
          label: 'CPU, memory, disk, and network — the four things a box can run out of.',
        },
        {
          id: 'golden',
          label: 'How slow, how busy, how many errors, how full — latency, traffic, errors, saturation.',
        },
        {
          id: 'logs',
          label: 'Logs, traces, metrics, and dashboards — the four kinds of observability.',
        },
      ],
      solution: { type: 'chooseOption', stepId: 'name-signals', optionId: 'golden' },
      goal: (_state, event) =>
        event.type === 'optionChosen' &&
        event.stepId === 'name-signals' &&
        event.optionId === 'golden',
      wrongAnswers: {
        cpu: 'Kai: "Those are box resources. Useful, but they don’t tell you if checkout works. Try the customer-facing four."',
        logs: 'Kai: "Those are kinds of data. The golden signals are what we chart: slow, busy, errors, full."',
      },
    },
    {
      id: 'open-logs',
      title: 'Open Logs',
      body: 'Open **Logs** in Grafauxna. Filter to **billing** and type **checkout** in search. This is the only other box you’ll type in besides your name.',
      hints: ['Logs is in Grafauxna’s own nav.'],
      solution: { type: 'clickTarget', targetId: 'grafauxna-logs' },
      goal: (_state, event) =>
        event.type === 'targetClicked' && event.targetId === 'grafauxna-logs',
      afterNote: 'Logs are the story. Charts are the plot. You need both.',
    },
  ],
  mentorQuestions: ['slo-vs-sla'],
  summary: [
    'The golden signals are how slow, how busy, how many errors, and how full.',
    'Logs are searchable English. You type to search, not to command the cluster.',
  ],
}
