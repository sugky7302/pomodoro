import { STORAGE_KEY, createDefaultData, normalizeData } from './data'
import type { PomodoroData } from './types'

const getStorage = () => chrome.storage.local

/**
 * 從 Chrome 本機儲存空間載入番茄鐘資料
 * @returns Promise 解析為正規化後的資料，若不存在則建立預設值
 * @throws 當 Chrome API 出錯時拋出 Error
 */
export const loadData = async (): Promise<PomodoroData> => {
  const storage = getStorage()
  const result = await new Promise<Record<string, PomodoroData | undefined>>((resolve, reject) => {
    storage.get([STORAGE_KEY], (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(items)
    })
  })

  const stored = result[STORAGE_KEY]
  if (!stored) {
    const initial = createDefaultData()
    await saveData(initial)
    return initial
  }

  const normalized = normalizeData(stored)
  await saveData(normalized)
  return normalized
}

/**
 * 儲存番茄鐘資料到 Chrome 本機儲存空間
 * @param data - 要儲存的資料，會自動更新 updatedAt 時間戳
 * @throws 當 Chrome API 出錯時拋出 Error
 */
export const saveData = async (data: PomodoroData): Promise<void> => {
  const storage = getStorage()
  const payload = { ...data, updatedAt: new Date().toISOString() }
  await new Promise<void>((resolve, reject) => {
    storage.set({ [STORAGE_KEY]: payload }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve()
    })
  })
}
