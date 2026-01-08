/**
 * 取得 Google Drive 存取權杖
 * @param interactive - 是否允許互動式授權流程（顯示登入視窗）
 * @returns Promise 解析為存取權杖字串
 * @throws 當無法取得權杖或使用者拒絕授權時拋出 Error
 */
export const getDriveToken = (interactive = false): Promise<string> =>
  new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      if (!token) {
        reject(new Error('無法取得存取權杖'))
        return
      }
      resolve(token)
    })
  })

/**
 * 清除快取的存取權杖（用於登出或權杖失效時）
 * @param token - 要清除的權杖
 * @returns Promise 在清除完成後解析
 */
export const clearCachedToken = (token: string) =>
  new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve())
  })
