import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsView } from './SettingsView'

afterEach(cleanup)

const noop = () => {}
const asyncOk = async () => ({ ok: true, message: '' })

function renderSettings(overrides: { onExport?: () => void; onExportCsv?: () => void; canExportCsv?: boolean } = {}) {
  return render(<SettingsView librarySummary="" planStatus="" onOpenLibrary={noop} restTimer={false} onRestTimer={noop} cloudEnabled={false} accountEmail={null} status="" pendingCount={0} onSignIn={asyncOk} onSignUp={asyncOk} onReset={asyncOk} onSignOut={noop} onBackupAll={noop} onRestore={noop} onExport={noop} onExportCsv={noop} canExportCsv onImport={noop} onNewBlock={noop} onFeedback={asyncOk} {...overrides} />)
}

describe('SettingsView export', () => {
  it('renders Export JSON and Export CSV and calls the matching handler', () => {
    const onExport = vi.fn()
    const onExportCsv = vi.fn()
    renderSettings({ onExport, onExportCsv })
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExportCsv).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(onExportCsv).toHaveBeenCalledTimes(1)
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it('disables Export CSV when there is no history but keeps Export JSON on', () => {
    renderSettings({ canExportCsv: false })
    expect((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Export JSON' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('explains both downloads', () => {
    renderSettings()
    expect(screen.getByText('Download a full backup (JSON) or your sets as a spreadsheet (CSV), or merge a backup from another device.')).toBeTruthy()
  })
})
