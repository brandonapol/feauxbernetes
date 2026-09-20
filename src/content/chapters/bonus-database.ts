import type { Chapter } from '../../engine/story/types'
import { startingWorld } from './helpers'

export const databaseUpgradeChapter: Chapter = {
  id: 'bonus-database',
  title: 'Database upgrade day',
  milestone: 'bonus',
  intro:
    'The dragon from Ch 4, up close. You watch — you don’t drive. The point is respect for the hard parts, not how they work.',
  setup: (state) => {
    const world = startingWorld(state)
    return {
      ...world,
      ui: {
        ...world.ui,
        activeTab: 'arghcd',
        unlockedTabs: ['flack', 'inkwell', 'arghcd', 'gitnub'],
        gitOpsEnforced: true,
      },
      flack: { ...world.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'open-dragon',
      title: 'Open the dragon',
      body: 'Open Argh CD’s **database** tile. We’re going to watch an upgrade. You won’t click Make it so.',
      hints: ['Applications, then the tile with the dragon.'],
      solution: { type: 'clickTarget', targetId: 'database' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'database',
      onEnter: [
        {
          type: 'flackMessage',
          id: 'kai-operator',
          channel: 'platform',
          from: 'kai',
          text: 'A specialised robot — engineers call it an **operator** — will do this. We watch. We do not improvise.',
        },
      ],
    },
    {
      id: 'stages',
      title: 'Six careful steps',
      body: 'Web’s rolling update in Ch 4 was one motion: new copies in, old copies out. The database does six: take a backup → upgrade the standby copy → check it has caught up → switch over → upgrade the old primary → done. Why the extra care?',
      hints: ['It remembers things. A copy of web does not.'],
      options: [
        { id: 'slow', label: 'The database is just slower to start.' },
        {
          id: 'remembers',
          label: 'It remembers things. A careless restart can lose or scramble data.',
        },
      ],
      solution: { type: 'chooseOption', stepId: 'stages', optionId: 'remembers' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'stages' && event.optionId === 'remembers',
      wrongAnswers: {
        slow: 'Kai: "Start time isn’t the point. The data is unique. Copies of web are identical and replaceable."',
      },
    },
    {
      id: 'when',
      title: 'When should we do this?',
      body: 'The robot is ready. When do we run the upgrade?',
      hints: ['Not during the sale. Not at Friday 5pm if we can help it.'],
      options: [
        { id: 'tue', label: 'Tuesday 10am — a quiet morning, people around.' },
        { id: 'fri', label: 'Friday 5pm — get it in before the weekend.' },
        { id: 'sale', label: 'During the big sale — more eyes on it.' },
      ],
      solution: { type: 'chooseOption', stepId: 'when', optionId: 'tue' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'when' && event.optionId === 'tue',
      wrongAnswers: {
        fri: 'Kai: "If it goes wrong you own the weekend. Tuesday morning we have a whole day of people."',
        sale: 'Kai: "More eyes, more customers hurting. Never change the dragon during the sale."',
      },
    },
  ],
  mentorQuestions: ['why-databases-are-hard'],
  summary: [
    'Web upgrades in one rolling motion. The database takes six careful steps.',
    'An operator is the specialised robot that does this. We watch; we don’t improvise.',
    'Do it on a quiet morning, not during the sale and not at Friday 5pm.',
  ],
}
