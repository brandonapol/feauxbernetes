import { describe, expect, it } from 'vitest'

import { errorBudget } from './slo'
import {
  describeAllowedFailures,
  describeAllowedOutage,
  describeBurnRate,
  humanCount,
  humanDuration,
} from './humanUnits'

describe('humanDuration', () => {
  it('renders minutes for under an hour', () => {
    expect(humanDuration(43.2)).toBe('43.2 minutes')
  })

  it('renders hours between an hour and a day', () => {
    expect(humanDuration(204)).toBe('3.4 hours')
  })

  it('renders days beyond that', () => {
    expect(humanDuration(60 * 24 * 2.5)).toBe('2.5 days')
  })
})

describe('humanCount', () => {
  it('rounds and groups thousands', () => {
    expect(humanCount(1400)).toBe('≈1,400')
  })
})

describe('describeAllowedFailures', () => {
  it('matches planning.md\'s "≈1,400 failed checkouts out of 280,000 in 28 days"', () => {
    const budget = errorBudget(0.995, 28, 280_000, 280_000)
    expect(describeAllowedFailures(budget, 280_000, 28, 'checkouts')).toBe(
      '≈1,400 failed checkouts out of 280,000 in 28 days'
    )
  })
})

describe('describeAllowedOutage', () => {
  it('matches planning.md\'s "43.2 minutes" for 99.9%/30 days', () => {
    const budget = errorBudget(0.999, 30, 1, 1)
    expect(describeAllowedOutage(budget)).toBe('43.2 minutes of full outage allowed')
  })
})

describe('describeBurnRate', () => {
  it('matches the "14.4x" phrasing used in Ch 8 and Ch 9', () => {
    expect(describeBurnRate(14.4)).toBe('burning the budget 14.4x too fast')
  })
})
