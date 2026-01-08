import { describe, expect, it } from 'vitest'
import { createDefaultData, normalizeData } from './data'

describe('data', () => {
  it('建立預設資料應有正確結構', () => {
    const data = createDefaultData()
    expect(data.version).toBe(1)
    expect(data.settings.focusMinutes).toBe(25)
    expect(data.state.currentPhase).toBe('focus')
    expect(data.state.isRunning).toBe(false)
    expect(data.groups).toEqual([])
    expect(data.tags).toEqual([])
    expect(data.todos).toEqual([])
    expect(data.sessions).toEqual([])
  })

  it('正規化資料應保留有效欄位', () => {
    const partial = {
      settings: { focusMinutes: 30 },
      groups: [{ id: 'g1', name: '工作', color: '#ff0000' }]
    }
    const normalized = normalizeData(partial)
    expect(normalized.settings.focusMinutes).toBe(30)
    expect(normalized.settings.shortBreakMinutes).toBe(5) // 預設值
    expect(normalized.groups).toHaveLength(1)
    expect(normalized.groups[0].id).toBe('g1')
  })

  it('正規化資料應修正無效的剩餘秒數', () => {
    const partial = {
      state: { secondsRemaining: -10 }
    }
    const normalized = normalizeData(partial)
    expect(normalized.state.secondsRemaining).toBe(25 * 60)
  })

  it('正規化資料應補齊遺失的必要欄位', () => {
    const partial = {}
    const normalized = normalizeData(partial)
    expect(normalized.version).toBe(1)
    expect(normalized.settings).toBeDefined()
    expect(normalized.state).toBeDefined()
    expect(normalized.driveConfig).toBeDefined()
  })

  it('正規化資料應修正待辦清單欄位', () => {
    const partial = {
      todos: [
        {
          id: 't1',
          title: '  ',
          plannedPomodoros: 0,
          completedPomodoros: -2
        }
      ]
    }
    const normalized = normalizeData(partial)
    expect(normalized.todos[0].title).toBe('未命名')
    expect(normalized.todos[0].plannedPomodoros).toBe(1)
    expect(normalized.todos[0].completedPomodoros).toBe(0)
  })

  it('正規化資料應移除不存在的當前任務', () => {
    const partial = {
      state: { activeTodoId: 'missing' },
      todos: [{ id: 't1', title: '測試', plannedPomodoros: 1, completedPomodoros: 0 }]
    }
    const normalized = normalizeData(partial)
    expect(normalized.state.activeTodoId).toBeUndefined()
  })
})
