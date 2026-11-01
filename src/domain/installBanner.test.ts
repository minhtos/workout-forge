import { beforeEach, describe, expect, it } from 'vitest'
import { bannerStateKey, detectInstallPlatform, loadBannerState, nextBannerState, saveBannerState, visibleBannerState } from './installBanner'

const chrome = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
const iosSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ipadSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const iosChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1'
const iosOther = (token: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${token}`
const firefox = 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'
const samsung = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36'

const env = (userAgent: string, extra: { canPrompt?: boolean, standalone?: boolean, maxTouchPoints?: number } = {}) => ({ userAgent, canPrompt: false, standalone: false, maxTouchPoints: 0, ...extra })

describe('detectInstallPlatform', () => {
  it('finds Chromium when the browser supports the install prompt', () => {
    expect(detectInstallPlatform(env(chrome, { canPrompt: true }))).toBe('chromium')
    expect(detectInstallPlatform(env(edge, { canPrompt: true }))).toBe('chromium')
  })

  it('finds iPhone and iPad Safari (iPadOS reports a Mac user agent)', () => {
    expect(detectInstallPlatform(env(iosSafari))).toBe('ios')
    expect(detectInstallPlatform(env(ipadSafari, { maxTouchPoints: 5 }))).toBe('ios')
  })

  it('gives Firefox, Samsung Internet, other iOS browsers and desktop Safari the generic steps', () => {
    expect(detectInstallPlatform(env(firefox))).toBe('other')
    expect(detectInstallPlatform(env(samsung, { canPrompt: true }))).toBe('other')
    expect(detectInstallPlatform(env(iosChrome))).toBe('other')
    expect(detectInstallPlatform(env(ipadSafari))).toBe('other')
  })

  it.each([['Google app', 'GSA/350.0.0 Safari/604.1'], ['DuckDuckGo', 'Ddg/18.0 Safari/604.1'], ['Facebook', '[FBAN/FBIOS;FBAV/480.0]'], ['Instagram', 'Instagram 350.0.0'], ['Google WebView', 'GoogleWv/1.0']])('gives the iOS %s browser the generic steps', (_name, token) => {
    expect(detectInstallPlatform(env(iosOther(token)))).toBe('other')
  })

  it('treats Chrome without prompt support as generic', () => {
    expect(detectInstallPlatform(env(chrome))).toBe('other')
  })

  it('reports standalone first, whatever the browser', () => {
    expect(detectInstallPlatform(env(chrome, { canPrompt: true, standalone: true }))).toBe('standalone')
    expect(detectInstallPlatform(env(iosSafari, { standalone: true }))).toBe('standalone')
  })
})

describe('banner state', () => {
  beforeEach(() => window.localStorage.clear())

  it('defaults to full when nothing is stored, and ignores junk', () => {
    expect(loadBannerState()).toBe('full')
    window.localStorage.setItem(bannerStateKey, 'nonsense')
    expect(loadBannerState()).toBe('full')
  })

  it('close goes to off and persists', () => {
    saveBannerState(nextBannerState('close'))
    expect(window.localStorage.getItem(bannerStateKey)).toBe('off')
    expect(loadBannerState()).toBe('off')
  })

  it('minimize goes to min and persists', () => {
    saveBannerState(nextBannerState('minimize'))
    expect(loadBannerState()).toBe('min')
  })

  it('tapping the chip returns to full', () => {
    saveBannerState('min')
    saveBannerState(nextBannerState('expand'))
    expect(loadBannerState()).toBe('full')
  })

  it('closing the chip sets off', () => {
    saveBannerState('min')
    expect(nextBannerState('close')).toBe('off')
  })

  it('standalone overrides a stored full (and every other stored state)', () => {
    saveBannerState('full')
    expect(visibleBannerState(loadBannerState(), 'standalone')).toBe('off')
    expect(visibleBannerState('min', 'standalone')).toBe('off')
    expect(visibleBannerState('full', 'chromium')).toBe('full')
    expect(visibleBannerState('min', 'ios')).toBe('min')
  })
})
