import type { DriveConfig, PomodoroData, PomodoroSettings, TimerState } from './types'

export const STORAGE_KEY = 'pomodoro-data'

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false
}

export const DEFAULT_DRIVE_CONFIG: DriveConfig = {
  folderPath: 'Pomodoro',
  fileName: 'pomodoro-data.json'
}

export const createDefaultState = (settings: PomodoroSettings): TimerState => ({
  currentPhase: 'focus',
  isRunning: false,
  secondsRemaining: settings.focusMinutes * 60,
  cycleCount: 0,
  activeTagIds: []
})

export const createDefaultData = (): PomodoroData => {
  const settings = { ...DEFAULT_SETTINGS }
  return {
    version: 1,
    settings,
    groups: [],
    tags: [],
    sessions: [],
    state: createDefaultState(settings),
    driveConfig: { ...DEFAULT_DRIVE_CONFIG },
    updatedAt: new Date().toISOString()
  }
}

export const normalizeData = (data: Partial<PomodoroData>): PomodoroData => {
  const base = createDefaultData()
  const settings = { ...base.settings, ...data.settings }
  const state = { ...base.state, ...data.state }
  if (!state.secondsRemaining || state.secondsRemaining <= 0) {
    state.secondsRemaining = settings.focusMinutes * 60
  }

  return {
    ...base,
    ...data,
    settings,
    state,
    groups: data.groups ?? base.groups,
    tags: data.tags ?? base.tags,
    sessions: data.sessions ?? base.sessions,
    driveConfig: { ...base.driveConfig, ...data.driveConfig },
    updatedAt: data.updatedAt ?? base.updatedAt
  }
}
