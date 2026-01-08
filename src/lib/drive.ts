import type { DriveConfig, PomodoroData } from './types'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

const requestJson = async <T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Drive 錯誤：${response.status} ${error}`)
  }

  return (await response.json()) as T
}

const requestText = async (
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<string> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Drive 錯誤：${response.status} ${error}`)
  }

  return await response.text()
}

const normalizeFolderPath = (path: string) =>
  path
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

const findFolderInParent = async (
  token: string,
  parentId: string,
  name: string
) => {
  const q = [
    `mimeType='application/vnd.google-apps.folder'`,
    `name='${name.replace(/'/g, "\\'")}'`,
    parentId === 'root' ? `'root' in parents` : `'${parentId}' in parents`,
    'trashed=false'
  ].join(' and ')
  const url = `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`
  const result = await requestJson<{ files: { id: string; name: string }[] }>(
    url,
    token
  )
  return result.files[0]?.id
}

const createFolder = async (
  token: string,
  parentId: string,
  name: string
) => {
  const body = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId === 'root' ? undefined : [parentId]
  }
  const result = await requestJson<{ id: string }>(`${DRIVE_BASE}/files`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  return result.id
}

const ensureFolderPath = async (token: string, path: string) => {
  const segments = normalizeFolderPath(path)
  let parentId = 'root'
  for (const segment of segments) {
    const existing = await findFolderInParent(token, parentId, segment)
    parentId = existing ?? (await createFolder(token, parentId, segment))
  }
  return parentId
}

const findFileInParent = async (
  token: string,
  parentId: string,
  name: string
) => {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    parentId === 'root' ? `'root' in parents` : `'${parentId}' in parents`,
    'trashed=false'
  ].join(' and ')
  const url = `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`
  const result = await requestJson<{ files: { id: string; name: string }[] }>(
    url,
    token
  )
  return result.files[0]?.id
}

const createFile = async (
  token: string,
  parentId: string,
  name: string,
  content: string
) => {
  const boundary = `pomodoro_${crypto.randomUUID()}`
  const metadata = {
    name,
    parents: parentId === 'root' ? undefined : [parentId],
    mimeType: 'application/json'
  }
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    content,
    `--${boundary}--`,
    ''
  ].join('\r\n')

  const result = await requestJson<{ id: string }>(
    `${DRIVE_UPLOAD}/files?uploadType=multipart`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  )
  return result.id
}

const updateFile = async (token: string, fileId: string, content: string) => {
  await requestText(
    `${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`,
    token,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: content
    }
  )
}

const downloadFile = async (token: string, fileId: string) => {
  return await requestText(`${DRIVE_BASE}/files/${fileId}?alt=media`, token)
}

/**
 * 將本機資料同步到 Google Drive
 * @param token - Google OAuth 存取權杖
 * @param data - 要同步的番茄鐘資料
 * @param config - Drive 配置（資料夾路徑與檔名）
 * @returns Promise 解析為更新後的 Drive 配置（含 folderId, fileId, lastSyncAt）
 * @throws 當 API 請求失敗或網路錯誤時拋出 Error
 */
export const syncToDrive = async (
  token: string,
  data: PomodoroData,
  config: DriveConfig
) => {
  const folderId = await ensureFolderPath(token, config.folderPath)
  let fileId = config.fileId
  if (!fileId) {
    fileId = await findFileInParent(token, folderId, config.fileName)
  }

  const content = JSON.stringify(
    {
      ...data,
      driveConfig: {
        ...config,
        folderId,
        fileId
      },
      updatedAt: new Date().toISOString()
    },
    null,
    2
  )

  if (fileId) {
    await updateFile(token, fileId, content)
  } else {
    fileId = await createFile(token, folderId, config.fileName, content)
  }

  return {
    ...config,
    folderId,
    fileId,
    lastSyncAt: new Date().toISOString()
  }
}

/**
 * 從 Google Drive 載入資料並覆蓋本機
 * @param token - Google OAuth 存取權杖
 * @param config - Drive 配置（資料夾路徑與檔名）
 * @returns Promise 解析為包含 data 與 config 的物件
 * @throws 當找不到檔案或 API 請求失敗時拋出 Error
 */
export const syncFromDrive = async (token: string, config: DriveConfig) => {
  const folderId = await ensureFolderPath(token, config.folderPath)
  let fileId = config.fileId
  if (!fileId) {
    fileId = await findFileInParent(token, folderId, config.fileName)
  }
  if (!fileId) {
    throw new Error('找不到雲端檔案，請先同步到 Drive')
  }
  const content = await downloadFile(token, fileId)
  const parsed = JSON.parse(content) as PomodoroData
  return {
    data: parsed,
    config: {
      ...config,
      folderId,
      fileId,
      lastSyncAt: new Date().toISOString()
    }
  }
}
