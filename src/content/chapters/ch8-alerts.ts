import type { Chapter } from '../../engine/story/types'
import { startingWorld } from './helpers'

export const alertsChapter: Chapter = {
  id: 'ch8-alerts',
  title: 'Wake me only if it matters',
  milestone: 'm2',
  intro:
    'A page at 3am has to earn it. You’ll replay last week through three rules and pick the one that pages for the real incident, not the noise.',
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
      id: 'open-replay',
      title: 'Open Replay',
      body: 'In Grafauxna, open **Replay**. You’ll see last week of billing errors run through three rules.',
      hints: ['Replay is in Grafauxna’s nav, next to Alerts.'],
      solution: { type: 'clickTarget', targetId: 'grafauxna-replay' },
      goal: (_state, event) =>
        event.type === 'targetClicked' && event.targetId === 'grafauxna-replay',
    },
    {
      id: 'pick-rule',
      title: 'Which rule would you sleep under?',
      body: 'Look at **Replay**: each rule shows how many times it would have paged last week. Which rule would you actually sleep under?',
      hints: ['The one that pages for the real incident, not the blips.'],
      thinking:
        'A page has to earn 3am. Noise trains you to ignore the pager — that’s how real outages get missed.',
      options: [
        { id: 'any', label: 'Page on any error — never miss anything.' },
        { id: 'threshold', label: 'Page if errors stay above 5% for 30 minutes.' },
        {
          id: 'burn',
          label: 'Page when we’re burning the budget much too fast (the 1h + 5m rule).',
        },
      ],
      solution: { type: 'chooseOption', stepId: 'pick-rule', optionId: 'burn' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'pick-rule' && event.optionId === 'burn',
      wrongAnswers: {
        any: 'Kai: "That one pages dozens of times a week, including at night. You’d start ignoring it. That’s how the real one gets missed."',
        threshold:
          'Kai: "Safer, but it waits 30 minutes into a real outage. Customers have been failing checkout the whole time. Burn-rate is faster on the real one and quiet on the blips."',
      },
    },
    {
      id: 'sort',
      title: 'Page, ticket, or dashboard?',
      body: 'A blip that cleared in 15 minutes. Where does it belong?',
      hints: ['If it doesn’t need a human at 3am, it isn’t a page.'],
      options: [
        { id: 'page', label: 'Page — wake someone.' },
        { id: 'ticket', label: 'Ticket — look at it in the morning.' },
        { id: 'dash', label: 'Dashboard only — it already cleared.' },
      ],
      solution: { type: 'chooseOption', stepId: 'sort', optionId: 'dash' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'sort' && event.optionId === 'dash',
      wrongAnswers: {
        page: 'Kai: "It cleared. Nobody needed to get out of bed. That’s how you train people to ignore pages."',
        ticket:
          'Kai: "A ticket is for something a human should still do. This one vanished on its own. Dashboard is enough."',
      },
    },
  ],
  mentorQuestions: ['slo-vs-sla'],
  summary: [
    'A page has to earn 3am. Noise trains you to ignore the next one.',
    'Burn-rate pages for the real outage and stays quiet on blips.',
    'Some things are tickets. Some things are just dashboards.',
  ],
}
