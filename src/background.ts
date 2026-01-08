import { createDefaultData, normalizeData, normalizeTodos } from './lib/data'
import { syncFromDrive, syncToDrive } from './lib/drive'
import { getDriveToken } from './lib/driveAuth'
import { createId } from './lib/id'
import { loadData, saveData } from './lib/storage'
import {
  getPhaseDurationSeconds,
  pauseTimer,
  resetTimer,
  skipPhase,
  startTimer,
  tickTimer
} from './lib/timer'
import type { MessageRequest, MessageResponse, PomodoroData } from './lib/types'

const END_ALARM = 'pomodoro-end'
const OFFSCREEN_URL = 'offscreen.html'
const OFFSCREEN_TARGET = 'offscreen'

type OffscreenMessage = {
  target: 'offscreen'
  type: 'playSound'
}

const isOffscreenMessage = (message: unknown): message is OffscreenMessage =>
  typeof message === 'object' &&
  message !== null &&
  'target' in message &&
  (message as OffscreenMessage).target === OFFSCREEN_TARGET

const hasOffscreenDocument = async () => {
  const getContexts = (chrome.runtime as unknown as {
    getContexts?: (options: { contextTypes: string[] }) => Promise<unknown[]>
  }).getContexts
  if (getContexts) {
    const contexts = await getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
    return contexts.length > 0
  }
  const clients = await self.clients.matchAll()
  const url = chrome.runtime.getURL(OFFSCREEN_URL)
  return clients.some((client) => client.url === url)
}

const ensureOffscreenDocument = async () => {
  if (!chrome.offscreen) return
  const exists = await hasOffscreenDocument()
  if (exists) return
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['AUDIO_PLAYBACK'],
    justification: '播放番茄鐘到期提醒音效'
  })
}

const playAlarmSound = async () => {
  try {
    if (!chrome.offscreen) return
    await ensureOffscreenDocument()
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ target: OFFSCREEN_TARGET, type: 'playSound' }, () => {
        resolve()
      })
    })
  } catch {
    // 音效播放失敗時忽略，避免中斷計時流程
  }
}

const scheduleEndAlarm = async (targetEndAt?: number) => {
  await chrome.alarms.clear(END_ALARM)
  if (targetEndAt) {
    chrome.alarms.create(END_ALARM, { when: targetEndAt })
  }
}

const updateData = async (
  updater: (data: PomodoroData) => PomodoroData
): Promise<PomodoroData> => {
  const current = await loadData()
  const next = updater(current)
  await saveData(next)
  return next
}

const notifyPhaseComplete = async (phase: string, todoTitle?: string) => {
  const suffix = todoTitle ? `（${todoTitle}）` : ''
  await chrome.notifications.create({
    type: 'basic',
    title: '番茄鐘完成',
    message: `已完成 ${phase}${suffix}，準備切換下一階段。`,
    iconUrl: 'icons/icon-128.png',
    requireInteraction: true,
    silent: true
  })
}

const notifyTodoComplete = async (title: string) => {
  await chrome.notifications.create({
    type: 'basic',
    title: '任務完成',
    message: `「${title}」已完成全部番茄鐘。`,
    iconUrl: 'icons/icon-128.png',
    requireInteraction: true,
    silent: true
  })
}

const handleTimerCompletion = async () => {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const data = await loadData()
  const result = tickTimer(data.state, data.settings, now)
  if (!result.completedPhase) {
    return
  }

  const next: PomodoroData = {
    ...data,
    state: result.state
  }
  let completedTodoTitle: string | undefined

  if (result.completedFocus) {
    next.sessions = [
      {
        id: createId(),
        type: 'focus' as const,
        startAt: new Date(result.completedFocus.startAt).toISOString(),
        endAt: new Date(result.completedFocus.endAt).toISOString(),
        durationMinutes: Math.round(result.completedFocus.durationSeconds / 60),
        groupId: result.completedFocus.groupId,
        tagIds: result.completedFocus.tagIds,
        todoId: result.completedFocus.todoId
      },
      ...next.sessions
    ].slice(0, 200)

    if (result.completedFocus.todoId) {
      next.todos = next.todos.map((todo) => {
        if (todo.id !== result.completedFocus.todoId) return todo
        const planned = Math.max(1, todo.plannedPomodoros)
        const completed = todo.completedPomodoros + 1
        const isCompleted = completed >= planned
        if (isCompleted && !todo.isCompleted) {
          completedTodoTitle = todo.title
        }
        return {
          ...todo,
          completedPomodoros: completed,
          isCompleted,
          updatedAt: nowIso
        }
      })
    }
  }

  await saveData(next)
  await scheduleEndAlarm(next.state.targetEndAt)
  await playAlarmSound()
  await notifyPhaseComplete(
    result.completedPhase === 'focus'
      ? '專注'
      : result.completedPhase === 'shortBreak'
        ? '短休息'
        : '長休息',
    completedTodoTitle ?? next.todos.find((todo) => todo.id === data.state.activeTodoId)
      ?.title
  )
  if (completedTodoTitle) {
    await notifyTodoComplete(completedTodoTitle)
  }
}

const adjustRemainingForSettings = (
  data: PomodoroData,
  settings: PomodoroData['settings']
) => {
  if (data.state.isRunning) return data.state
  return {
    ...data.state,
    secondsRemaining: getPhaseDurationSeconds(data.state.currentPhase, settings)
  }
}

const handleMessage = async (
  message: MessageRequest
): Promise<MessageResponse> => {
  try {
    switch (message.type) {
      case 'getData': {
        const data = await loadData()
        return { ok: true, data }
      }
      case 'updateSettings': {
        const data = await updateData((current) => {
          const state = adjustRemainingForSettings(current, message.payload)
          return {
            ...current,
            settings: message.payload,
            state
          }
        })
        return { ok: true, data }
      }
      case 'updateGroups': {
        const data = await updateData((current) => {
          const groupIds = new Set(message.payload.map((group) => group.id))
          const activeGroupId = groupIds.has(current.state.activeGroupId ?? '')
            ? current.state.activeGroupId
            : undefined
          return {
            ...current,
            groups: message.payload,
            state: {
              ...current.state,
              activeGroupId
            }
          }
        })
        return { ok: true, data }
      }
      case 'updateTags': {
        const data = await updateData((current) => {
          const tagIds = new Set(message.payload.map((tag) => tag.id))
          return {
            ...current,
            tags: message.payload,
            state: {
              ...current.state,
              activeTagIds: current.state.activeTagIds.filter((id) => tagIds.has(id))
            }
          }
        })
        return { ok: true, data }
      }
      case 'updateTodos': {
        const data = await updateData((current) => {
          const todos = normalizeTodos(message.payload)
          const activeTodoId = todos.some((todo) => todo.id === current.state.activeTodoId)
            ? current.state.activeTodoId
            : undefined
          return {
            ...current,
            todos,
            state: {
              ...current.state,
              activeTodoId
            }
          }
        })
        return { ok: true, data }
      }
      case 'setActiveGroup': {
        const data = await updateData((current) => ({
          ...current,
          state: {
            ...current.state,
            activeGroupId: message.payload
          }
        }))
        return { ok: true, data }
      }
      case 'setActiveTags': {
        const data = await updateData((current) => {
          const available = new Set(current.tags.map((tag) => tag.id))
          return {
            ...current,
            state: {
              ...current.state,
              activeTagIds: message.payload.filter((id) => available.has(id))
            }
          }
        })
        return { ok: true, data }
      }
      case 'setActiveTodo': {
        const data = await updateData((current) => {
          const available = new Set(current.todos.map((todo) => todo.id))
          const activeTodoId =
            message.payload && available.has(message.payload) ? message.payload : undefined
          return {
            ...current,
            state: {
              ...current.state,
              activeTodoId
            }
          }
        })
        return { ok: true, data }
      }
      case 'timerStart': {
        const now = Date.now()
        const data = await updateData((current) => ({
          ...current,
          state: startTimer(current.state, current.settings, now)
        }))
        await scheduleEndAlarm(data.state.targetEndAt)
        return { ok: true, data }
      }
      case 'timerPause': {
        const now = Date.now()
        const data = await updateData((current) => ({
          ...current,
          state: pauseTimer(current.state, now)
        }))
        await scheduleEndAlarm(undefined)
        return { ok: true, data }
      }
      case 'timerReset': {
        const data = await updateData((current) => ({
          ...current,
          state: resetTimer(current.state, current.settings)
        }))
        await scheduleEndAlarm(undefined)
        return { ok: true, data }
      }
      case 'timerSkip': {
        const data = await updateData((current) => ({
          ...current,
          state: skipPhase(current.state, current.settings)
        }))
        await scheduleEndAlarm(undefined)
        return { ok: true, data }
      }
      case 'updateDriveConfig': {
        const data = await updateData((current) => {
          const changed =
            current.driveConfig.folderPath !== message.payload.folderPath ||
            current.driveConfig.fileName !== message.payload.fileName
          const driveConfig = changed
            ? {
                ...message.payload,
                folderId: undefined,
                fileId: undefined,
                lastSyncAt: undefined
              }
            : message.payload
          return {
            ...current,
            driveConfig
          }
        })
        return { ok: true, data }
      }
      case 'driveSyncTo': {
        const token = await getDriveToken(true)
        const data = await loadData()
        const driveConfig = await syncToDrive(token, data, data.driveConfig)
        const updated = await updateData((current) => ({
          ...current,
          driveConfig
        }))
        return { ok: true, data: updated }
      }
      case 'driveSyncFrom': {
        const token = await getDriveToken(true)
        const current = await loadData()
        const result = await syncFromDrive(token, current.driveConfig)
        const normalized = normalizeData({
          ...result.data,
          driveConfig: result.config
        })
        await saveData(normalized)
        return { ok: true, data: normalized }
      }
      default:
        return { ok: false, error: '未知的指令' }
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  loadData().catch(() => saveData(createDefaultData()))
})

chrome.runtime.onStartup.addListener(() => {
  loadData().catch(() => saveData(createDefaultData()))
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === END_ALARM) {
    handleTimerCompletion().catch(() => null)
  }
})

chrome.runtime.onMessage.addListener(
  (message: MessageRequest | OffscreenMessage, _sender, sendResponse) => {
    if (isOffscreenMessage(message)) {
      return false
    }
    handleMessage(message)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : '未知錯誤'
        })
      )
    return true
  }
)
