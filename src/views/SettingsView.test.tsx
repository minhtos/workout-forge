import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changelog } from '../domain/changelog'
import { fullInventory, type EquipmentInventory } from '../domain/equipment'
import { SettingsView } from './SettingsView'

afterEach(cleanup)

const noop = () => {}
const asyncOk = async () => ({ ok: true, message: '' })

function renderSettings(overrides: { onExport?: () => void; onExportCsv?: () => void; canExportCsv?: boolean; equipment?: EquipmentInventory; onEquipment?: (next: EquipmentInventory) => void } = {}) {
  return render(<SettingsView librarySummary="" planStatus="" onOpenLibrary={noop} restTimer={false} onRestTimer={noop} equipment={fullInventory} onEquipment={noop} cloudEnabled={false} accountEmail={null} status="" pendingCount={0} onSignIn={asyncOk} onSignUp={asyncOk} onReset={asyncOk} onSignOut={noop} onBackupAll={noop} onRestore={noop} onExport={noop} onExportCsv={noop} canExportCsv onImport={noop} onNewBlock={noop} onFeedback={asyncOk} {...overrides} />)
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

describe('SettingsView changelog', () => {
  it('lists every entry newest first, with the version label only on versioned entries', () => {
    renderSettings()
    expect(screen.getByRole('heading', { name: 'Changelog' })).toBeTruthy()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(headings).toHaveLength(changelog.length)
    expect(headings[0]).toBe('Version 0.3.0 · 11 Nov 2026')
    expect(headings.slice(1)).toEqual(['Version 0.2.1 · 11 Nov 2026', 'Version 0.2.0 · 11 Nov 2026', 'Version 0.1.0 · 11 Nov 2026', '8 Nov 2026', '7 Nov 2026', '5 Nov 2026'])
    expect(screen.getByText('New: warm-up hint above the set table for barbell compound lifts.')).toBeTruthy()
  })
})

describe('SettingsView equipment', () => {
  const chip = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

  it('T33 renders 6 plate chips and 33 dumbbell chips, all checked, with Check all disabled', () => {
    renderSettings()
    const chips = (noun: string) => screen.getAllByRole('button', { name: new RegExp(`^[\\d.]+ lb ${noun}$`) })
    expect(chips('plates')).toHaveLength(6)
    expect(chips('dumbbells')).toHaveLength(33)
    for (const each of [...chips('plates'), ...chips('dumbbells')]) expect(each.getAttribute('aria-pressed')).toBe('true')
    expect(chip('Check all').disabled).toBe(true)
  })

  it('T34 toggles a size through onEquipment, and Check all restores the full inventory', () => {
    const onEquipment = vi.fn()
    renderSettings({ onEquipment })
    fireEvent.click(chip('35 lb plates'))
    expect(onEquipment).toHaveBeenLastCalledWith({ missingPlates: [35], missingDumbbells: [] })
    cleanup()
    renderSettings({ equipment: { missingPlates: [35], missingDumbbells: [7.5] }, onEquipment })
    expect(chip('35 lb plates').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(chip('2.5 lb plates'))
    expect(onEquipment).toHaveBeenLastCalledWith({ missingPlates: [35, 2.5], missingDumbbells: [7.5] })
    expect(chip('Check all').disabled).toBe(false)
    fireEvent.click(chip('Check all'))
    expect(onEquipment).toHaveBeenLastCalledWith(fullInventory)
  })

  it('T35 disables the last checked chip of a kind', () => {
    renderSettings({ equipment: { missingPlates: [45, 35, 25, 10, 5], missingDumbbells: [] } })
    expect(chip('2.5 lb plates').disabled).toBe(true)
    expect(chip('2.5 lb plates').title).toBe('Keep at least one size checked')
    expect(chip('45 lb plates').disabled).toBe(false)
    expect(chip('50 lb dumbbells').disabled).toBe(false)
  })

  it('T44 shows the keep-one-checked hint where everyone can read it', () => {
    renderSettings()
    expect(screen.getByText('At least one size stays checked in each list.').tagName).toBe('P')
  })
})
