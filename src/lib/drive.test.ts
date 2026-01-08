import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultData, DEFAULT_DRIVE_CONFIG } from './data'
import { syncFromDrive, syncToDrive } from './drive'

const okJson = (data: unknown) =>
  Promise.resolve({
    ok: true,
    json: async () => data,
    text: async () => JSON.stringify(data)
  })

const okText = (text: string) =>
  Promise.resolve({
    ok: true,
    json: async () => JSON.parse(text),
    text: async () => text
  })

describe('drive sync', () => {
  const token = 'token'

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('會建立資料夾並上傳檔案', async () => {
    const data = createDefaultData()
    const fetchMock = vi.mocked(fetch)

    fetchMock
      .mockImplementationOnce(() => okJson({ files: [] }))
      .mockImplementationOnce(() => okJson({ id: 'folder-1' }))
      .mockImplementationOnce(() => okJson({ files: [] }))
      .mockImplementationOnce(() => okJson({ id: 'file-1' }))

    const result = await syncToDrive(token, data, DEFAULT_DRIVE_CONFIG)
    expect(result.folderId).toBe('folder-1')
    expect(result.fileId).toBe('file-1')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('會下載並解析雲端檔案', async () => {
    const data = createDefaultData()
    const fetchMock = vi.mocked(fetch)

    fetchMock
      .mockImplementationOnce(() => okJson({ files: [{ id: 'folder-1' }] }))
      .mockImplementationOnce(() => okJson({ files: [{ id: 'file-1' }] }))
      .mockImplementationOnce(() => okText(JSON.stringify(data)))

    const result = await syncFromDrive(token, DEFAULT_DRIVE_CONFIG)
    expect(result.config.folderId).toBe('folder-1')
    expect(result.config.fileId).toBe('file-1')
    expect(result.data.version).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
