import type { MessageRequest, MessageResponse, PomodoroData } from './types'

export const sendMessage = async <T = PomodoroData>(
  message: MessageRequest
): Promise<MessageResponse<T>> =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message })
        return
      }
      if (!response) {
        resolve({ ok: false, error: '背景服務未回應，請重新載入擴充功能' })
        return
      }
      resolve(response)
    })
  })
