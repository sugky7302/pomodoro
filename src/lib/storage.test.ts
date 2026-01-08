import { describe, expect, it, vi, beforeEach } from 'vitest'
import { loadData, saveData } from './storage'
import { createDefaultData } from './data'

// Mock Chrome API
const mockStorage = {
  get: vi.fn(),
  set: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).chrome = {
    storage: {
      local: mockStorage
    },
    runtime: {
      lastError: undefined
    }
  }
})

describe('storage', () => {
  it('載入不存在的資料應建立預設值', async () => {
    mockStorage.get.mockImplementation((keys, callback) => {
      callback({})
    })
    mockStorage.set.mockImplementation((data, callback) => {
      callback()
    })

    const data = await loadData()
    expect(data.version).toBe(1)
    expect(data.settings.focusMinutes).toBe(25)
    expect(mockStorage.set).toHaveBeenCalled()
  })

  it('載入已存在的資料應正規化並回傳', async () => {
    const stored = {
      'pomodoro-data': {
        version: 1,
        settings: { focusMinutes: 30 },
        state: { currentPhase: 'focus', isRunning: false }
      }
    }
    mockStorage.get.mockImplementation((keys, callback) => {
      callback(stored)
    })
    mockStorage.set.mockImplementation((data, callback) => {
      callback()
    })

    const data = await loadData()
    expect(data.settings.focusMinutes).toBe(30)
  })

  it('儲存資料應更新 updatedAt 時間戳', async () => {
    const now = new Date('2026-01-08T12:00:00Z')
    vi.setSystemTime(now)

    mockStorage.set.mockImplementation((data, callback) => {
      expect(data['pomodoro-data'].updatedAt).toBe(now.toISOString())
      callback()
    })

    const testData = createDefaultData()
    await saveData(testData)
    expect(mockStorage.set).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('Chrome API 錯誤應拋出例外', async () => {
    ;(globalThis as any).chrome.runtime.lastError = { message: '儲存失敗' }
    mockStorage.set.mockImplementation((data, callback) => {
      callback()
    })

    const testData = createDefaultData()
    await expect(saveData(testData)).rejects.toThrow('儲存失敗')
  })
})
