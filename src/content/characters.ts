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
}
