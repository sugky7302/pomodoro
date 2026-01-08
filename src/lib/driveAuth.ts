type OAuthConfig = {
  clientId: string
  scopes: string[]
}

const FALLBACK_TOKEN_KEY = 'pomodoroDriveFallbackToken'
const FALLBACK_EXPIRY_KEY = 'pomodoroDriveFallbackExpiry'

const storageGet = (keys: string[]) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(items)
    })
  })

const storageSet = (data: Record<string, unknown>) =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve()
    })
  })

const storageRemove = (keys: string[]) =>
  new Promise<void>((resolve) => {
    chrome.storage.local.remove(keys, () => resolve())
  })

const getOAuthConfig = (): OAuthConfig => {
  const manifest = chrome.runtime.getManifest()
  const clientId = manifest.oauth2?.client_id
  const scopes = manifest.oauth2?.scopes
  if (!clientId || !scopes || scopes.length === 0) {
    throw new Error('OAuth 設定缺失，請確認 manifest.json 的 oauth2 區段')
  }
  return { clientId, scopes }
}

const getStoredFallbackToken = async () => {
  const result = await storageGet([FALLBACK_TOKEN_KEY, FALLBACK_EXPIRY_KEY])
  const token = result[FALLBACK_TOKEN_KEY] as string | undefined
  const expiry = result[FALLBACK_EXPIRY_KEY] as number | undefined
  if (!token || !expiry) return undefined
  if (Date.now() >= expiry) return undefined
  return token
}

const setStoredFallbackToken = async (token: string, expiresIn: number) => {
  const expiresAt = Date.now() + Math.max(0, expiresIn - 60) * 1000
  await storageSet({
    [FALLBACK_TOKEN_KEY]: token,
    [FALLBACK_EXPIRY_KEY]: expiresAt
  })
}

const getRedirectHint = () => {
  const runtimeId = chrome.runtime?.id ?? '未知'
  const redirectUrl = chrome.identity?.getRedirectURL?.()
  if (redirectUrl) {
    return `擴充功能 ID：${runtimeId}，redirect URI：${redirectUrl}`
  }
  return `擴充功能 ID：${runtimeId}`
}

const formatOAuthError = (error: string, description?: string) => {
  if (error === 'redirect_uri_mismatch') {
    return `OAuth 授權失敗：redirect_uri_mismatch。請確認 Google Cloud OAuth 用戶端已設定 ${getRedirectHint()}。`
  }
  if (description) {
    return `OAuth 授權失敗：${error}（${description}）`
  }
  return `OAuth 授權失敗：${error}`
}

const parseAuthRedirect = (redirectUrl: string) => {
  const url = new URL(redirectUrl)
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  const params = new URLSearchParams(hash)
  const error = params.get('error')
  if (error) {
    const description = params.get('error_description') ?? undefined
    throw new Error(formatOAuthError(error, description))
  }
  const token = params.get('access_token')
  const expiresIn = Number(params.get('expires_in') || '0')
  if (!token) {
    throw new Error('授權回應缺少 access_token')
  }
  return { token, expiresIn }
}

const buildAuthUrl = (config: OAuthConfig, interactive: boolean) => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', chrome.identity.getRedirectURL())
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('scope', config.scopes.join(' '))
  authUrl.searchParams.set('include_granted_scopes', 'true')
  authUrl.searchParams.set('prompt', interactive ? 'consent' : 'none')
  return authUrl.toString()
}

const getTokenViaLaunchWebAuthFlow = async (interactive: boolean): Promise<string> => {
  const cached = await getStoredFallbackToken()
  if (cached) return cached

  if (!chrome.identity?.launchWebAuthFlow) {
    throw new Error('瀏覽器不支援 OAuth 授權流程')
  }
  const config = getOAuthConfig()
  const url = buildAuthUrl(config, interactive)
  const redirectUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      if (!responseUrl) {
        reject(
          new Error(
            `授權流程未返回結果，請確認 Google Cloud OAuth 用戶端已設定 ${getRedirectHint()}。`
          )
        )
        return
      }
      resolve(responseUrl)
    })
  })
  const { token, expiresIn } = parseAuthRedirect(redirectUrl)
  if (expiresIn > 0) {
    await setStoredFallbackToken(token, expiresIn)
  }
  return token
}

const getTokenViaChromeIdentity = (interactive: boolean): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!chrome.identity?.getAuthToken) {
      reject(new Error('identity API 不可用'))
      return
    }
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
 * 取得 Google Drive 存取權杖
 * @param interactive - 是否允許互動式授權流程（顯示登入視窗）
 * @returns Promise 解析為存取權杖字串
 * @throws 當無法取得權杖或使用者拒絕授權時拋出 Error
 */
export const getDriveToken = async (interactive = false): Promise<string> => {
  try {
    return await getTokenViaChromeIdentity(interactive)
  } catch (error) {
    return await getTokenViaLaunchWebAuthFlow(interactive)
  }
}

/**
 * 清除快取的存取權杖（用於登出或權杖失效時）
 * @param token - 要清除的權杖
 * @returns Promise 在清除完成後解析
 */
export const clearCachedToken = (token: string) =>
  new Promise<void>((resolve) => {
    if (chrome.identity?.removeCachedAuthToken) {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve())
      return
    }
    resolve()
  }).then(() => storageRemove([FALLBACK_TOKEN_KEY, FALLBACK_EXPIRY_KEY]))
