import { describe, expect, it } from 'vitest'

import { attainment, burnRate, errorBudget } from './slo'

describe('attainment', () => {
  it('is good divided by valid', () => {
    expect(attainment(998, 1000)).toBe(0.998)
  })

  it('reads as fully attained when there is no traffic yet', () => {
    expect(attainment(0, 0)).toBe(1)
  })
})

describe('errorBudget', () => {
  it('99.9% over 30 days is 43.2 minutes of allowed outage (planning.md, Ch 7)', () => {
    const budget = errorBudget(0.999, 30, 1, 1)
    expect(budget.allowedMinutes).toBeCloseTo(43.2, 5)
  })

  it('99.5% over 28 days of 280,000 checkouts is about 1,400 allowed failures (planning.md, Ch 7)', () => {
    const budget = errorBudget(0.995, 28, 280_000, 280_000)
    expect(Math.round(budget.allowedEvents)).toBe(1400)
  })

  it('tracks spent and remaining events as bad events happen', () => {
    const budget = errorBudget(0.999, 30, 280_000, 279_720) // 280 bad events
    expect(budget.allowedEvents).toBeCloseTo(280, 5)
    expect(budget.spentEvents).toBe(280)
    expect(budget.remainingEvents).toBeCloseTo(0, 5)
  })

  it('spending the whole budget spends all the allowed minutes too', () => {
    const budget = errorBudget(0.999, 30, 1000, 999) // exactly 1 of the 1 allowed bad event
    expect(budget.spentMinutes).toBeCloseTo(budget.allowedMinutes, 5)
    expect(budget.remainingMinutes).toBeCloseTo(0, 5)
  })
})

describe('burnRate', () => {
  it('is 1 when spending exactly on budget', () => {
    // 99.9% target allows 0.1% bad; spending exactly 0.1% bad is burn rate 1.
    expect(burnRate(0.999, 999, 1000)).toBeCloseTo(1, 5)
  })

  it('is 0 with no bad events', () => {
    expect(burnRate(0.999, 1000, 1000)).toBe(0)
  })

  it('is 14.4 for the Ch 8/9 checkout incident (12% actual against a 99.9% target with 0.1% budget)', () => {
    // 12% bad / 0.1% allowed = 120x -- comfortably over the 14.4x "page now" threshold.
    expect(burnRate(0.999, 88, 100)).toBeGreaterThan(14.4)
  })
})
