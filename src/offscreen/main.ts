/**
 * Offscreen Document - 專用於播放音效
 * Chrome MV3 service worker 無法直接播放音效，需透過 offscreen document
 */

const audio = new Audio(chrome.runtime.getURL('audio/alert.wav'))
audio.preload = 'auto'

type OffscreenMessage = {
  target: 'offscreen'
  type: 'playSound'
}

/**
 * 播放提醒音效
 * @description 重置播放位置並播放音效，失敗時靜默忽略
 */
const playSound = async () => {
  try {
    audio.currentTime = 0
    await audio.play()
  } catch {
    // 忽略音效播放錯誤（可能因使用者互動限制）
  }
}

chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (message?.target === 'offscreen' && message.type === 'playSound') {
    playSound().finally(() => sendResponse({ ok: true }))
    return true
  }
  return false
})

