export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak' | 'idle'

export type PomodoroSettings = {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
}

export type PomodoroGroup = {
  id: string
  name: string
  color: string
}

export type PomodoroTag = {
  id: string
  name: string
  color: string
}

export type PomodoroTodo = {
  id: string
  title: string
  plannedPomodoros: number
  completedPomodoros: number
  isCompleted: boolean
  createdAt: string
  updatedAt?: string
}

export type PomodoroSession = {
  id: string
  type: 'focus'
  startAt: string
  endAt: string
  durationMinutes: number
  groupId?: string
  tagIds: string[]
  todoId?: string
  note?: string
}

export type TimerState = {
  currentPhase: TimerPhase
  isRunning: boolean
  secondsRemaining: number
  targetEndAt?: number
  cycleCount: number
  activeGroupId?: string
  activeTagIds: string[]
  activeTodoId?: string
  currentSessionStartAt?: number
}

export type DriveConfig = {
  folderPath: string
  fileName: string
  folderId?: string
  fileId?: string
  lastSyncAt?: string
}

export type PomodoroData = {
  version: 1
  settings: PomodoroSettings
  groups: PomodoroGroup[]
  tags: PomodoroTag[]
  todos: PomodoroTodo[]
  sessions: PomodoroSession[]
  state: TimerState
  driveConfig: DriveConfig
  updatedAt: string
}

export type MessageRequest =
  | { type: 'getData' }
  | { type: 'updateSettings'; payload: PomodoroSettings }
  | { type: 'updateGroups'; payload: PomodoroGroup[] }
  | { type: 'updateTags'; payload: PomodoroTag[] }
  | { type: 'updateTodos'; payload: PomodoroTodo[] }
  | { type: 'setActiveGroup'; payload?: string }
  | { type: 'setActiveTags'; payload: string[] }
  | { type: 'setActiveTodo'; payload?: string }
  | { type: 'timerStart' }
  | { type: 'timerPause' }
  | { type: 'timerReset' }
  | { type: 'timerSkip' }
  | { type: 'updateDriveConfig'; payload: DriveConfig }
  | { type: 'driveSyncTo' }
  | { type: 'driveSyncFrom' }

export type MessageResponse<T = PomodoroData> =
  | { ok: true; data: T }
  | { ok: false; error: string }
