import type { Character } from '../engine/story/types'

// The cast, as introduced in planning.md → "Story, world and characters". They/them or names
// only in all copy — never he/she (see content.test.ts).
export const characters: Record<string, Character> = {
  morgan: {
    id: 'morgan',
    name: 'Morgan Diaz',
    initials: 'MD',
    role: 'SRE team lead',
    color: '#1864ab',
  },
  kai: {
    id: 'kai',
    name: 'Kai Nakamura',
    initials: 'KN',
    role: 'Senior SRE',
    color: '#9c36b5',
  },
  alex: {
    id: 'alex',
    name: 'Alex Chen',
    initials: 'AC',
    role: 'Software engineer',
    color: '#237032',
  },
  robin: {
    id: 'robin',
    name: 'Robin Okafor',
    initials: 'RO',
    role: 'Senior technical writer',
    color: '#c2410c',
  },
  taylor: {
    id: 'taylor',
    name: 'Taylor Brooks',
    initials: 'TB',
    role: 'Support lead',
    color: '#f59f00',
  },

  // The bots (planning.md → "Flack (#12)"): each posts to one Flack channel and never appears in
  // person anywhere else. `isBot` shows the "BOT" badge next to their name in Flack.
  arghcd: {
    id: 'arghcd',
    name: 'Argh CD',
    initials: 'CD',
    role: 'Posts every sync to #deploys',
    color: '#495057',
    isBot: true,
  },
  pagerdoody: {
    id: 'pagerdoody',
    name: 'PagerDoody',
    initials: 'PD',
    role: 'Posts pages to #alerts',
    color: '#c92a2a',
    isBot: true,
  },
  gitnub: {
    id: 'gitnub',
    name: 'GitNub',
    initials: 'GN',
    role: 'Posts check results on pull requests',
    color: '#1c7ed6',
    isBot: true,
  },
}
