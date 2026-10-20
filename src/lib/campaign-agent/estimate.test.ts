import { describe, expect, it } from 'vitest'
import { estimateCost, MARKETING_PRICE } from './estimate'

describe('estimateCost', () => {
  it('prices the first message and bounds the follow-ups', () => {
    const e = estimateCost(250, 2)
    expect(e.firstMessage).toBeCloseTo(250 * MARKETING_PRICE, 2)
    expect(e.upperBound).toBeCloseTo(e.firstMessage * 3, 2)
  })
  it('handles empty audiences', () => {
    expect(estimateCost(0, 2)).toEqual({ firstMessage: 0, upperBound: 0 })
  })
})
