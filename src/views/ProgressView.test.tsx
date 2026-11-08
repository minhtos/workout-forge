import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mergeCatalog } from '../domain/program'
import { set } from '../domain/testSets'
import { ProgressView } from './ProgressView'

afterEach(cleanup)

const day = (ago: number) => new Date(Date.now() - ago * 86400000)
const view = (history: ReturnType<typeof set>[], custom: Parameters<typeof mergeCatalog>[0] = []) =>
  render(<ProgressView history={history} catalog={mergeCatalog(custom)} finished={1} total={4} activeSessionId={null} targets={null} />)
const exerciseRows = () => within(document.querySelector('.exercise-table')!).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent)

describe('ProgressView logged names', () => {
  it('shows the current catalog name for a renamed built-in id in the exercise list and the latest-set heading', () => {
    view([set('a', 1, day(1), { exerciseId: 'quad-extension', exerciseName: 'Quad Extension' })])
    expect(exerciseRows()).toEqual(['Leg Extension'])
    expect(screen.getByRole('heading', { name: /^Leg Extension: / })).toBeTruthy()
    expect(screen.queryByText(/Quad Extension/)).toBeNull()
  })

  it('follows a renamed custom exercise and keeps the stored name for a deleted one', () => {
    const history = [set('a', 1, day(2), { exerciseId: 'custom-curl', exerciseName: 'My Curl' }), set('b', 1, day(1), { exerciseId: 'custom-gone', exerciseName: 'Deleted Curl' })]
    view(history, [{ id: 'custom-curl', name: 'Preacher Curl', category: 'Biceps' }])
    expect(exerciseRows()).toEqual(['Deleted Curl', 'Preacher Curl'])
    expect(screen.getByRole('heading', { name: /^Deleted Curl: / })).toBeTruthy()
  })
})
