import type {
  DriveConfig,
  PomodoroData,
  PomodoroSettings,
  PomodoroTodo,
  TimerState
} from './types'

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

const clampTodoNumber = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.round(value))
}

export const normalizeTodos = (
  todos: PomodoroTodo[],
  nowIso = new Date().toISOString()
): PomodoroTodo[] =>
  todos.map((todo) => {
    const planned = Math.max(1, clampTodoNumber(todo.plannedPomodoros, 1))
    const completed = clampTodoNumber(todo.completedPomodoros, 0)
    const isCompleted = todo.isCompleted ?? completed >= planned
    return {
      ...todo,
      title: todo.title?.trim() || '未命名',
      plannedPomodoros: planned,
      completedPomodoros: completed,
      isCompleted,
      createdAt: todo.createdAt ?? nowIso,
      updatedAt: todo.updatedAt ?? nowIso
    }
  })

export const createDefaultData = (): PomodoroData => {
  const settings = { ...DEFAULT_SETTINGS }
  return {
    version: 1,
    settings,
    groups: [],
    tags: [],
    todos: [],
    sessions: [],
    state: createDefaultState(settings),
    driveConfig: { ...DEFAULT_DRIVE_CONFIG },
    updatedAt: new Date().toISOString()
  }
}

export const normalizeData = (data: Partial<PomodoroData>): PomodoroData => {
  const base = createDefaultData()
  const nowIso = new Date().toISOString()
  const settings = { ...base.settings, ...data.settings }
  const todos = normalizeTodos(data.todos ?? base.todos, nowIso)
  const state = { ...base.state, ...data.state }
  const activeTodoId = todos.some((todo) => todo.id === state.activeTodoId)
    ? state.activeTodoId
    : undefined
  if (!state.secondsRemaining || state.secondsRemaining <= 0) {
    state.secondsRemaining = settings.focusMinutes * 60
  }

  return {
    ...base,
    ...data,
    settings,
    state: {
      ...state,
      activeTodoId
    },
    groups: data.groups ?? base.groups,
    tags: data.tags ?? base.tags,
    todos,
    sessions: data.sessions ?? base.sessions,
    driveConfig: { ...base.driveConfig, ...data.driveConfig },
    updatedAt: data.updatedAt ?? nowIso
  }
}
