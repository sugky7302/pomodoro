import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDriveToken } from './driveAuth'

type ChromeIdentity = {
  getAuthToken?: (options: { interactive: boolean }, cb: (token?: string) => void) => void
  launchWebAuthFlow?: (
    options: { url: string; interactive: boolean },
    cb: (responseUrl?: string) => void
  ) => void
  getRedirectURL?: () => string
}

const createChromeMock = () => {
  const identity: ChromeIdentity = {
    getAuthToken: vi.fn(),
    launchWebAuthFlow: vi.fn(),
    getRedirectURL: vi.fn(() => 'https://example.chromiumapp.org/')
  }
  const storage = {
    local: {
      get: vi.fn(),
      set: vi.fn((_data, cb) => cb()),
      remove: vi.fn((_keys, cb) => cb())
    }
  }
  const runtime = {
    lastError: undefined as { message: string } | undefined,
    id: 'test-extension',
    getManifest: () => ({
      oauth2: {
        client_id: 'test-client',
        scopes: ['https://www.googleapis.com/auth/drive.file']
      }
    })
  }
  return { identity, storage, runtime }
}

describe('driveAuth', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-08T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('使用 chrome.identity.getAuthToken 取得權杖', async () => {
    const chromeMock = createChromeMock()
    ;(globalThis as any).chrome = chromeMock

    chromeMock.identity.getAuthToken?.mockImplementation((_options, cb) => {
      cb('token-123')
    })

    const token = await getDriveToken(true)
    expect(token).toBe('token-123')
    expect(chromeMock.identity.getAuthToken).toHaveBeenCalled()
    expect(chromeMock.identity.launchWebAuthFlow).not.toHaveBeenCalled()
  })

  it('當 getAuthToken 失敗時改用授權視窗', async () => {
    const chromeMock = createChromeMock()
    ;(globalThis as any).chrome = chromeMock

    chromeMock.storage.local.get.mockImplementation((_keys, cb) => cb({}))

    chromeMock.identity.getAuthToken?.mockImplementation((_options, cb) => {
      chromeMock.runtime.lastError = { message: 'OAuth2 設定缺失' }
      cb(undefined)
      chromeMock.runtime.lastError = undefined
    })

    chromeMock.identity.launchWebAuthFlow?.mockImplementation((_options, cb) => {
      cb('https://example.chromiumapp.org/#access_token=fallback&expires_in=3600')
    })

    const token = await getDriveToken(true)
    expect(token).toBe('fallback')
    expect(chromeMock.identity.launchWebAuthFlow).toHaveBeenCalled()
    expect(chromeMock.storage.local.set).toHaveBeenCalled()
  })

  it('可使用快取的 fallback 權杖', async () => {
    const chromeMock = createChromeMock()
    ;(globalThis as any).chrome = chromeMock

    chromeMock.storage.local.get.mockImplementation((_keys, cb) =>
      cb({
        pomodoroDriveFallbackToken: 'cached',
        pomodoroDriveFallbackExpiry: new Date('2026-01-08T12:10:00Z').getTime()
      })
    )

    chromeMock.identity.getAuthToken?.mockImplementation((_options, cb) => {
      chromeMock.runtime.lastError = { message: 'OAuth2 設定缺失' }
      cb(undefined)
      chromeMock.runtime.lastError = undefined
    })

    const token = await getDriveToken(true)
    expect(token).toBe('cached')
    expect(chromeMock.identity.launchWebAuthFlow).not.toHaveBeenCalled()
  })

  it('授權回應包含 redirect_uri_mismatch 時提供提示', async () => {
    const chromeMock = createChromeMock()
    ;(globalThis as any).chrome = chromeMock

    chromeMock.storage.local.get.mockImplementation((_keys, cb) => cb({}))

    chromeMock.identity.getAuthToken?.mockImplementation((_options, cb) => {
      chromeMock.runtime.lastError = { message: 'OAuth2 設定缺失' }
      cb(undefined)
      chromeMock.runtime.lastError = undefined
    })

    chromeMock.identity.launchWebAuthFlow?.mockImplementation((_options, cb) => {
      cb('https://example.chromiumapp.org/#error=redirect_uri_mismatch')
    })

    let error: unknown
    try {
      await getDriveToken(true)
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('redirect_uri_mismatch')
    expect((error as Error).message).toContain('test-extension')
    expect((error as Error).message).toContain('https://example.chromiumapp.org/')
  })
})
