import { describe, expect, it } from 'vitest'
import { feedbackProblem, maxFeedbackLength } from './feedback'

describe('feedbackProblem', () => {
  it('accepts a plain message with no email', () => {
    expect(feedbackProblem('The rest timer is great.', '')).toBeNull()
  })

  it('accepts a message with a plausible reply email', () => {
    expect(feedbackProblem('Please add a kettlebell swing.', 'me@example.com')).toBeNull()
  })

  it('rejects an empty or near-empty message', () => {
    expect(feedbackProblem('', '')).toMatch(/tell us a little more/i)
    expect(feedbackProblem(' hi ', '')).toMatch(/tell us a little more/i)
  })

  it('rejects a message over the limit', () => {
    expect(feedbackProblem('x'.repeat(maxFeedbackLength + 1), '')).toMatch(/under 2000 characters/i)
  })

  it('rejects a malformed email but allows leaving it blank', () => {
    expect(feedbackProblem('A real message here.', 'nope')).toMatch(/email does not look right/i)
    expect(feedbackProblem('A real message here.', '   ')).toBeNull()
  })
})
