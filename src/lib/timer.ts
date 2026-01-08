import type { PomodoroSettings, TimerPhase, TimerState } from './types'

export type CompletedFocus = {
  startAt: number
  endAt: number
  durationSeconds: number
  groupId?: string
  tagIds: string[]
}

export type TimerTickResult = {
  state: TimerState
  completedPhase?: TimerPhase
  completedFocus?: CompletedFocus
}

const resolvePhase = (phase: TimerPhase): TimerPhase =>
  phase === 'idle' ? 'focus' : phase

/**
 * 取得指定階段的持續時間（秒）
 * @param phase - 計時器階段（focus/shortBreak/longBreak/idle）
 * @param settings - 番茄鐘設定
 * @returns 階段持續時間（秒），最小為 60 秒
 */
export const getPhaseDurationSeconds = (
  phase: TimerPhase,
  settings: PomodoroSettings
) => {
  const resolved = resolvePhase(phase)
  if (resolved === 'focus') return settings.focusMinutes * 60
  if (resolved === 'shortBreak') return settings.shortBreakMinutes * 60
  return settings.longBreakMinutes * 60
}

const getNextPhase = (
  phase: TimerPhase,
  cycleCount: number,
  settings: PomodoroSettings
): { phase: TimerPhase; cycleCount: number } => {
  const resolved = resolvePhase(phase)
  if (resolved === 'focus') {
    const nextCycle = cycleCount + 1
    const isLong = nextCycle % settings.longBreakEvery === 0
    return {
      phase: (isLong ? 'longBreak' : 'shortBreak') as TimerPhase,
      cycleCount: nextCycle
    }
  }
  return {
    phase: 'focus' as TimerPhase,
    cycleCount
  }
}

/**
 * 啟動計時器
 * @param state - 當前計時器狀態
 * @param settings - 番茄鐘設定
 * @param now - 當前時間戳（毫秒）
 * @returns 新的計時器狀態，若已在執行則返回原狀態
 */
export const startTimer = (
  state: TimerState,
  settings: PomodoroSettings,
  now: number
): TimerState => {
  if (state.isRunning) return state
  const phase = resolvePhase(state.currentPhase)
  const duration =
    state.secondsRemaining > 0
      ? state.secondsRemaining
      : getPhaseDurationSeconds(phase, settings)

  return {
    ...state,
    currentPhase: phase,
    isRunning: true,
    secondsRemaining: duration,
    targetEndAt: now + duration * 1000,
    currentSessionStartAt:
      phase === 'focus' ? state.currentSessionStartAt ?? now : undefined
  }
}

/**
 * 暫停計時器
 * @param state - 當前計時器狀態
 * @param now - 當前時間戳（毫秒）
 * @returns 新的計時器狀態，保留剩餘秒數，若未執行則返回原狀態
 */
export const pauseTimer = (state: TimerState, now: number): TimerState => {
  if (!state.isRunning || !state.targetEndAt) return state
  const remaining = Math.max(0, Math.round((state.targetEndAt - now) / 1000))
  return {
    ...state,
    isRunning: false,
    secondsRemaining: remaining,
    targetEndAt: undefined
  }
}

/**
 * 重置計時器到初始狀態
 * @param state - 當前計時器狀態
 * @param settings - 番茄鐘設定
 * @returns 重置後的計時器狀態（停止、專注階段、輪數清零）
 */
export const resetTimer = (
  state: TimerState,
  settings: PomodoroSettings
): TimerState => ({
  ...state,
  currentPhase: 'focus',
  isRunning: false,
  secondsRemaining: settings.focusMinutes * 60,
  targetEndAt: undefined,
  currentSessionStartAt: undefined
})

/**
 * 跳過當前階段，直接進入下一階段
 * @param state - 當前計時器狀態
 * @param settings - 番茄鐘設定
 * @returns 新的計時器狀態（停止、下一階段、更新輪數）
 */
export const skipPhase = (
  state: TimerState,
  settings: PomodoroSettings
): TimerState => {
  const { phase, cycleCount } = getNextPhase(
    state.currentPhase,
    state.cycleCount,
    settings
  )
  return {
    ...state,
    currentPhase: phase,
    cycleCount,
    isRunning: false,
    secondsRemaining: getPhaseDurationSeconds(phase, settings),
    targetEndAt: undefined,
    currentSessionStartAt: undefined
  }
}

/**
 * 更新計時器狀態，處理時間流逝與階段切換
 * @param state - 當前計時器狀態
 * @param settings - 番茄鐘設定
 * @param now - 當前時間戳（毫秒）
 * @returns 更新結果，包含新狀態、完成的階段、完成的專注工作階段訊息
 */
export const tickTimer = (
  state: TimerState,
  settings: PomodoroSettings,
  now: number
): TimerTickResult => {
  if (!state.isRunning || !state.targetEndAt) {
    return { state }
  }

  const remaining = Math.max(0, Math.floor((state.targetEndAt - now) / 1000))
  if (remaining > 0) {
    return {
      state: {
        ...state,
        secondsRemaining: remaining
      }
    }
  }

  const completedPhase = state.currentPhase
  let completedFocus: CompletedFocus | undefined
  if (completedPhase === 'focus') {
    const startAt = state.currentSessionStartAt ?? now
    completedFocus = {
      startAt,
      endAt: now,
      durationSeconds: Math.max(0, Math.round((now - startAt) / 1000)),
      groupId: state.activeGroupId,
      tagIds: state.activeTagIds
    }
  }

  const { phase, cycleCount } = getNextPhase(
    state.currentPhase,
    state.cycleCount,
    settings
  )
  const nextDuration = getPhaseDurationSeconds(phase, settings)
  const autoStart =
    completedPhase === 'focus' ? settings.autoStartBreaks : settings.autoStartFocus

  const nextState: TimerState = {
    ...state,
    currentPhase: phase,
    cycleCount,
    isRunning: autoStart,
    secondsRemaining: nextDuration,
    targetEndAt: autoStart ? now + nextDuration * 1000 : undefined,
    currentSessionStartAt: autoStart && phase === 'focus' ? now : undefined
  }

  return { state: nextState, completedPhase, completedFocus }
}
