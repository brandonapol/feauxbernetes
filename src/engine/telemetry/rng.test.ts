import { describe, expect, it } from 'vitest'

import { hash01, noise } from './rng'

describe('hash01', () => {
  it('is deterministic: the same key always gives the same number', () => {
    expect(hash01('seed=1:billing:errorRate:500')).toBe(hash01('seed=1:billing:errorRate:500'))
  })

  it('stays within [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const value = hash01(`key-${i}`)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('gives different keys different numbers (almost always)', () => {
    expect(hash01('a')).not.toBe(hash01('b'))
  })
})

describe('noise', () => {
  it('stays within [-1, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const value = noise(`key-${i}`)
      expect(value).toBeGreaterThanOrEqual(-1)
      expect(value).toBeLessThan(1)
    }
  })
})
