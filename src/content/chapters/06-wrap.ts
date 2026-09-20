import type { Chapter } from '../../engine/story/types'
import { startingWorld } from './helpers'

export const wrapChapter: Chapter = {
  id: '06-wrap',
  title: 'Week one, in your pocket',
  milestone: 'm1',
  intro:
    'That’s the shipping loop. Next week: measuring “good,” then the pager. Take the field guide with you.',
  setup: (state) => {
    const world = startingWorld(state)
    return {
      ...world,
      ui: {
        ...world.ui,
        activeTab: 'flack',
        unlockedTabs: ['flack', 'inkwell', 'arghcd', 'gitnub'],
        gitOpsEnforced: true,
      },
      flack: { ...world.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'ready',
      title: 'Ready for next week?',
      body: 'Open the [SRE Field Guide](#/field-guide) (one printable page). The rest of the week — measuring good, alerts, and the pager — lands in later chapters. For now, you’re done with week one.',
      hints: ['Pick the one that isn’t “I want to type YAML.”'],
      options: [
        { id: 'yaml', label: 'I still think I should learn YAML this afternoon.' },
        { id: 'ready', label: 'I know the loop. I’m ready for measuring good.' },
        { id: 'panic', label: 'I’m not touching the pager. Ever.' },
      ],
      onEnter: [
        {
          type: 'flackMessage',
          id: 'morgan-wrap',
          channel: 'platform',
          from: 'morgan',
          text: "That's week one, {{player.name}}. You watched a change ship, you watched the cluster heal itself, and you watched the robots catch a bug. The field guide is yours. Next up is measuring good — SLOs — then alerts. On-call is a later chapter; we don't put you on the pager this week.",
        },
      ],
      solution: { type: 'chooseOption', stepId: 'ready', optionId: 'ready' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'ready' && event.optionId === 'ready',
      wrongAnswers: {
        yaml: 'Kai: "You can, later, if you’re curious. It isn’t the job. The field guide is."',
        panic:
          'Kai: "Everyone says that. Friday still comes. You’ll have a runbook, a dashboard, and me on the other end of Flack."',
      },
    },
  ],
  summary: [
    'Say what you want. GitNub is the source of truth. Argh CD makes it match.',
    'Copies die and come back. Boxes die and copies move. The wish stays.',
    'The robots catch bugs in English, before customers do.',
  ],
}
