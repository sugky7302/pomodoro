import { createDefaultData } from './lib/data'
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

const notifyPhaseComplete = async (phase: string) => {
  await chrome.notifications.create({
    type: 'basic',
    title: '番茄鐘完成',
    message: `已完成 ${phase}，準備切換下一階段。`,
    iconUrl: 'icons/icon-128.png'
  })
}

const handleTimerCompletion = async () => {
  const now = Date.now()
  const data = await loadData()
  const result = tickTimer(data.state, data.settings, now)
  if (!result.completedPhase) {
    return
  }

  const next: PomodoroData = {
    ...data,
    state: result.state
  }

  if (result.completedFocus) {
    next.sessions = [
      {
        id: createId(),
        type: 'focus' as const,
        startAt: new Date(result.completedFocus.startAt).toISOString(),
        endAt: new Date(result.completedFocus.endAt).toISOString(),
        durationMinutes: Math.round(result.completedFocus.durationSeconds / 60),
        groupId: result.completedFocus.groupId,
        tagIds: result.completedFocus.tagIds
      },
      ...next.sessions
    ].slice(0, 200)
  }

  await saveData(next)
  await scheduleEndAlarm(next.state.targetEndAt)
  await notifyPhaseComplete(
    result.completedPhase === 'focus'
      ? '專注'
      : result.completedPhase === 'shortBreak'
        ? '短休息'
        : '長休息'
  )
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
        const merged: PomodoroData = {
          ...result.data,
          driveConfig: result.config
        }
        await saveData(merged)
        return { ok: true, data: merged }
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
  (message: MessageRequest, _sender, sendResponse) => {
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
