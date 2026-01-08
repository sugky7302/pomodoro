const audio = new Audio(chrome.runtime.getURL('audio/alert.wav'))
audio.preload = 'auto'

type OffscreenMessage = {
  target: 'offscreen'
  type: 'playSound'
}

const playSound = async () => {
  try {
    audio.currentTime = 0
    await audio.play()
  } catch {
    // 忽略音效播放錯誤
  }
}

chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (message?.target === 'offscreen' && message.type === 'playSound') {
    playSound().finally(() => sendResponse({ ok: true }))
    return true
  }
  return false
})
