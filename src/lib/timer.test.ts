import { describe, expect, it } from 'vitest'
import { createDefaultState, DEFAULT_SETTINGS } from './data'
import {
  getPhaseDurationSeconds,
  pauseTimer,
  resetTimer,
  skipPhase,
  startTimer,
  tickTimer
} from './timer'

const baseSettings = {
  ...DEFAULT_SETTINGS,
  longBreakEvery: 2,
  autoStartBreaks: true,
  autoStartFocus: true
}

describe('timer', () => {
  it('啟動計時器會設定結束時間', () => {
    const state = createDefaultState(baseSettings)
    const now = 1_000_000
    const next = startTimer(state, baseSettings, now)
    expect(next.isRunning).toBe(true)
    expect(next.targetEndAt).toBe(now + next.secondsRemaining * 1000)
  })

  it('更新計時器會遞減剩餘秒數', () => {
    const now = 1_000_000
    const running = startTimer(createDefaultState(baseSettings), baseSettings, now)
    const later = now + 3_000
    const result = tickTimer(running, baseSettings, later)
    expect(result.state.secondsRemaining).toBe(
      Math.floor((running.targetEndAt! - later) / 1000)
    )
  })

  it('專注結束後切換為短休息並累計輪數', () => {
    const now = 1_000_000
    const running = startTimer(createDefaultState(baseSettings), baseSettings, now)
    const end = now + getPhaseDurationSeconds('focus', baseSettings) * 1000
    const result = tickTimer(running, baseSettings, end)
    expect(result.completedPhase).toBe('focus')
    expect(result.state.currentPhase).toBe('shortBreak')
    expect(result.state.cycleCount).toBe(1)
  })

  it('依設定進入長休息', () => {
    const now = 1_000_000
    const state = {
      ...createDefaultState(baseSettings),
      cycleCount: 1
    }
    const running = startTimer(state, baseSettings, now)
    const end = now + getPhaseDurationSeconds('focus', baseSettings) * 1000
    const result = tickTimer(running, baseSettings, end)
    expect(result.state.currentPhase).toBe('longBreak')
  })

  it('重置計時器回到專注狀態', () => {
    const state = createDefaultState(baseSettings)
    const reset = resetTimer(state, baseSettings)
    expect(reset.currentPhase).toBe('focus')
    expect(reset.isRunning).toBe(false)
  })

  it('暫停計時器應保留剩餘秒數', () => {
    const now = 1_000_000
    const running = startTimer(createDefaultState(baseSettings), baseSettings, now)
    const pauseAt = now + 5_000
    const paused = pauseTimer(running, pauseAt)
    expect(paused.isRunning).toBe(false)
    expect(paused.targetEndAt).toBeUndefined()
    expect(paused.secondsRemaining).toBeGreaterThan(0)
  })

  it('已暫停的計時器再次暫停應不變', () => {
    const state = createDefaultState(baseSettings)
    const paused = pauseTimer(state, Date.now())
    expect(paused).toEqual(state)
  })

  it('跳過階段應停止計時器並切換到下一階段', () => {
    const state = createDefaultState(baseSettings)
    const skipped = skipPhase(state, baseSettings)
    expect(skipped.isRunning).toBe(false)
    expect(skipped.currentPhase).toBe('shortBreak')
    expect(skipped.cycleCount).toBe(1)
  })

  it('專注階段完成應記錄工作階段訊息', () => {
    const now = 1_000_000
    const state = {
      ...createDefaultState(baseSettings),
      activeGroupId: 'group1',
      activeTagIds: ['tag1', 'tag2'],
      activeTodoId: 'todo1'
    }
    const running = startTimer(state, baseSettings, now)
    const end = now + getPhaseDurationSeconds('focus', baseSettings) * 1000
    const result = tickTimer(running, baseSettings, end)
    
    expect(result.completedFocus).toBeDefined()
    expect(result.completedFocus?.groupId).toBe('group1')
    expect(result.completedFocus?.tagIds).toEqual(['tag1', 'tag2'])
    expect(result.completedFocus?.todoId).toBe('todo1')
    expect(result.completedFocus?.durationSeconds).toBeGreaterThan(0)
  })

  it('休息階段完成不應記錄工作階段', () => {
    const now = 1_000_000
    const state = {
      ...createDefaultState(baseSettings),
      currentPhase: 'shortBreak' as const,
      secondsRemaining: baseSettings.shortBreakMinutes * 60
    }
    const running = startTimer(state, baseSettings, now)
    const end = running.targetEndAt!
    const result = tickTimer(running, baseSettings, end)
    
    expect(result.completedPhase).toBe('shortBreak')
    expect(result.completedFocus).toBeUndefined()
  })

  it('計時未結束時 tick 不應切換階段', () => {
    const now = 1_000_000
    const running = startTimer(createDefaultState(baseSettings), baseSettings, now)
    const halfWay = now + (getPhaseDurationSeconds('focus', baseSettings) * 500)
    const result = tickTimer(running, baseSettings, halfWay)
    
    expect(result.completedPhase).toBeUndefined()
    expect(result.state.currentPhase).toBe('focus')
  })

  it('idle 階段應轉換為 focus', () => {
    const state = {
      ...createDefaultState(baseSettings),
      currentPhase: 'idle' as const
    }
    const duration = getPhaseDurationSeconds('idle', baseSettings)
    expect(duration).toBe(baseSettings.focusMinutes * 60)
  })
})
