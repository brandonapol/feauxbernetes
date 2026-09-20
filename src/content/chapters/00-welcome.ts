import type { Chapter } from '../../engine/story/types'
import { startingWorld } from './helpers'

export const welcomeChapter: Chapter = {
  id: '00-welcome',
  title: 'Welcome to the platform team',
  milestone: 'm1',
  intro:
    "It's your first day as a Site Reliability Engineer at **Inkwell**. Morgan has already spotted you in Flack.",
  setup: (state) => {
    const world = startingWorld(state)
    return {
      ...world,
      ui: { ...world.ui, activeTab: 'flack', unlockedTabs: ['flack', 'inkwell', 'arghcd'] },
      flack: { ...world.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'say-hello',
      title: 'Say hello in #platform',
      body: 'Morgan has posted a welcome. Reply with one of the buttons under the message — no typing needed.',
      hints: ['The reply buttons are right under Morgan’s message, in the middle panel.'],
      solution: { type: 'flackReply', messageId: 'welcome', replyId: 'thanks' },
      goal: (_state, event) => event.type === 'flackReply' && event.messageId === 'welcome',
      afterNote:
        "That's Flack: the team’s chat. The rest of the week happens in these three panels.",
      onEnter: [
        {
          type: 'flackMessage',
          id: 'welcome',
          channel: 'platform',
          from: 'morgan',
          text: "Welcome to the platform team! Grab a coffee — I'm Morgan, I lead SRE here. First thing: tell us what to call you.",
          quickReplies: [
            { id: 'thanks', text: 'Thanks! Happy to be here' },
            { id: 'ready', text: 'Ready when you are' },
          ],
        },
      ],
    },
    {
      id: 'your-name',
      title: 'What should we call you?',
      body: 'Type your name in the box below. This is the only thing you’ll type all week besides searching logs later.',
      hints: ['The name box is in the left-hand Instructions panel.'],
      solution: { type: 'setPlayerName', name: 'Ada Lovelace' },
      goal: (_state, event) => event.type === 'playerNamed',
      apply: (state, event) =>
        event.type === 'playerNamed' ? { ...state, player: { name: event.name } } : state,
      afterNote: 'Kai will use that name. Everyone else will too.',
      onComplete: [
        {
          type: 'flackMessage',
          id: 'kai-intro',
          channel: 'dm-kai',
          from: 'kai',
          text: "Hey {{player.name}} — I'm Kai. You'll be shadowing me this week. Open this DM when you're ready and I'll show you around.",
          delayMs: 1500,
        },
      ],
    },
    {
      id: 'meet-kai',
      title: 'Open Kai’s DM',
      body: 'Kai messaged you privately. Open **Kai Nakamura** in Flack’s sidebar.',
      hints: ['Direct messages are the bottom of the Flack sidebar, under the channels.'],
      solution: { type: 'openChannel', channel: 'dm-kai' },
      goal: (_state, event) => event.type === 'channelOpened' && event.channel === 'dm-kai',
      afterNote:
        "Engineers build Inkwell. We make sure it stays up. Your job this week is to learn how we know it's up, and what we do when it isn't.",
      onComplete: [
        {
          type: 'flackMessage',
          id: 'kai-tour',
          channel: 'dm-kai',
          from: 'kai',
          text: "Quick tour. The middle panel is a fake browser. **Flack** is us. **inkwell.example** is what customers see. **Argh CD** is how we watch the boxes that run the site. The other tabs stay locked until later this week.\n\nPinned for the week:\n• Mon: how code ships\n• Tue: the robots\n• Wed: measuring good\n• Thu: alerts\n• Fri: you're on call",
          delayMs: 800,
        },
      ],
    },
    {
      id: 'open-inkwell',
      title: 'Open inkwell.example',
      body: 'Click the **inkwell.example** tab. That’s the writing app customers pay for — the thing we keep up.',
      hints: ['The tabs are along the top of the middle panel.'],
      solution: { type: 'openTab', tab: 'inkwell' },
      goal: (_state, event) => event.type === 'tabOpened' && event.tab === 'inkwell',
      afterNote:
        'If checkout breaks on Friday, this is where you’ll see it the way a customer does.',
    },
    {
      id: 'open-arghcd',
      title: 'Open Argh CD',
      body: 'Now open **Argh CD**. This is the window onto the boxes that run Inkwell. We’ll spend tomorrow here.',
      hints: ['Argh CD is the third tab in the fake browser.'],
      solution: { type: 'openTab', tab: 'arghcd' },
      goal: (_state, event) => event.type === 'tabOpened' && event.tab === 'arghcd',
      afterNote: 'Those tiles are the apps. Next chapter we look inside one.',
    },
    {
      id: 'the-job',
      title: 'What is the job this week?',
      body: 'Kai’s framing, in your own words. What are you here to learn?',
      hints: ['The one about knowing when the site is up, and what to do when it isn’t.'],
      options: [
        {
          id: 'write-yaml',
          label: 'How to write YAML and type cluster commands so I can manage the boxes myself.',
        },
        {
          id: 'stay-up',
          label: 'How we know Inkwell is up, and what we do when it isn’t.',
        },
        {
          id: 'build-features',
          label: 'How to ship new features in the writing app as fast as possible.',
        },
      ],
      solution: { type: 'chooseOption', stepId: 'the-job', optionId: 'stay-up' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'the-job' && event.optionId === 'stay-up',
      wrongAnswers: {
        'write-yaml':
          'Kai: "You will never type YAML or cluster commands here. The point is the job, not the tools. Try the one about knowing when we\'re up."',
        'build-features':
          'Kai: "Alex and the product engineers ship features. We make sure the site survives them. Close — but not the job."',
      },
    },
  ],
  mentorQuestions: ['why-not-restart'],
  summary: [
    'Flack is the team chat, inkwell.example is what customers see, and Argh CD is how we watch the boxes.',
    'Engineers build Inkwell. We make sure it stays up.',
    'Nothing here can break anything, and your progress is saved automatically.',
  ],
}
