import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackForm } from './FeedbackForm'

afterEach(cleanup)

const setup = () => {
  const onSubmit = vi.fn().mockResolvedValue({ ok: true, message: 'Sent — thank you.' })
  render(<FeedbackForm idPrefix="t" onSubmit={onSubmit} />)
  return { onSubmit }
}

describe('FeedbackForm', () => {
  it('sends a trimmed message and email, then clears the form', async () => {
    const { onSubmit } = setup()
    fireEvent.change(screen.getByLabelText(/your feedback/i), { target: { value: '  Add a kettlebell swing, please.  ' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: ' me@example.com ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Add a kettlebell swing, please.', 'me@example.com'))
    expect(screen.getByRole('status').textContent).toMatch(/sent/i)
    expect((screen.getByLabelText(/your feedback/i) as HTMLTextAreaElement).value).toBe('')
  })

  it('blocks an empty message before calling the sender', () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(screen.getByRole('alert').textContent).toMatch(/tell us a little more/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('blocks a malformed reply email', () => {
    const { onSubmit } = setup()
    fireEvent.change(screen.getByLabelText(/your feedback/i), { target: { value: 'A perfectly good message.' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(screen.getByRole('alert').textContent).toMatch(/email does not look right/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a send failure without clearing the draft', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: 'That did not send.' })
    render(<FeedbackForm idPrefix="t" onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText(/your feedback/i), { target: { value: 'Please keep my draft.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/did not send/i))
    expect((screen.getByLabelText(/your feedback/i) as HTMLTextAreaElement).value).toBe('Please keep my draft.')
  })
})
