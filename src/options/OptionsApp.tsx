import { useEffect, useMemo, useState } from 'react'
import { STORAGE_KEY } from '../lib/data'
import { createId } from '../lib/id'
import { sendMessage } from '../lib/messages'
import type {
  DriveConfig,
  PomodoroData,
  PomodoroGroup,
  PomodoroSettings,
  PomodoroTag,
  PomodoroTodo
} from '../lib/types'

const OptionsApp = () => {
  const [data, setData] = useState<PomodoroData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const [pendingSettings, setPendingSettings] = useState<PomodoroSettings | null>(null)
  const [pendingDrive, setPendingDrive] = useState<DriveConfig | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#ff6b4a')
  const [newTagColor, setNewTagColor] = useState('#2f6e6a')
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoPomodoros, setNewTodoPomodoros] = useState(1)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const response = await sendMessage({ type: 'getData' })
      if (!mounted) return
      if (response.ok) {
        setData(response.data)
        setPendingSettings(response.data.settings)
        setPendingDrive(response.data.driveConfig)
      } else {
        setError(response.error)
      }
    }
    load()
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && changes[STORAGE_KEY]?.newValue) {
        const next = changes[STORAGE_KEY].newValue as PomodoroData
        setData(next)
        setPendingSettings(next.settings)
        setPendingDrive(next.driveConfig)
      }
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      mounted = false
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  const updateSettings = async () => {
    if (!pendingSettings) return
    setSaving(true)
    const response = await sendMessage({
      type: 'updateSettings',
      payload: pendingSettings
    })
    setSaving(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const updateDriveConfig = async () => {
    if (!pendingDrive) return
    setSaving(true)
    const response = await sendMessage({
      type: 'updateDriveConfig',
      payload: pendingDrive
    })
    setSaving(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const syncToDrive = async () => {
    setSyncing(true)
    const response = await sendMessage({ type: 'driveSyncTo' })
    setSyncing(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const syncFromDrive = async () => {
    setSyncing(true)
    const response = await sendMessage({ type: 'driveSyncFrom' })
    setSyncing(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const groups = useMemo(() => data?.groups ?? [], [data])
  const tags = useMemo(() => data?.tags ?? [], [data])
  const todos = useMemo(() => data?.todos ?? [], [data])

  const updateGroups = async (nextGroups: PomodoroGroup[]) => {
    const response = await sendMessage({ type: 'updateGroups', payload: nextGroups })
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const updateTags = async (nextTags: PomodoroTag[]) => {
    const response = await sendMessage({ type: 'updateTags', payload: nextTags })
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const updateTodos = async (nextTodos: PomodoroTodo[]) => {
    const response = await sendMessage({ type: 'updateTodos', payload: nextTodos })
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const addGroup = async () => {
    const name = newGroupName.trim()
    if (!name) return
    const next = [...groups, { id: createId(), name, color: newGroupColor }]
    await updateGroups(next)
    setNewGroupName('')
  }

  const addTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    const next = [...tags, { id: createId(), name, color: newTagColor }]
    await updateTags(next)
    setNewTagName('')
  }

  const addTodo = async () => {
    const title = newTodoTitle.trim()
    if (!title) return
    const plannedPomodoros = Math.max(1, Number(newTodoPomodoros) || 1)
    const nowIso = new Date().toISOString()
    const next = [
      ...todos,
      {
        id: createId(),
        title,
        plannedPomodoros,
        completedPomodoros: 0,
        isCompleted: false,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ]
    await updateTodos(next)
    setNewTodoTitle('')
    setNewTodoPomodoros(1)
  }

  const updateGroup = async (id: string, patch: Partial<PomodoroGroup>) => {
    const next = groups.map((group) =>
      group.id === id ? { ...group, ...patch } : group
    )
    await updateGroups(next)
  }

  const updateTag = async (id: string, patch: Partial<PomodoroTag>) => {
    const next = tags.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag))
    await updateTags(next)
  }

  const updateTodo = async (id: string, patch: Partial<PomodoroTodo>) => {
    const next = todos.map((todo) =>
      todo.id === id ? { ...todo, ...patch, updatedAt: new Date().toISOString() } : todo
    )
    await updateTodos(next)
  }

  const removeGroup = async (id: string) => {
    const next = groups.filter((group) => group.id !== id)
    await updateGroups(next)
  }

  const removeTag = async (id: string) => {
    const next = tags.filter((tag) => tag.id !== id)
    await updateTags(next)
  }

  const removeTodo = async (id: string) => {
    const next = todos.filter((todo) => todo.id !== id)
    await updateTodos(next)
  }

  if (!data || !pendingSettings || !pendingDrive) {
    return (
      <div className="app options">
        <div className="card">
          <p className="muted">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app options">
      <header className="header">
        <div>
          <p className="eyebrow">設定中心</p>
          <h1>番茄鐘配置</h1>
        </div>
      </header>

      <section className="card fade-up">
        <h2>計時設定</h2>
        <div className="grid">
          <div className="field">
            <label>專注（分鐘）</label>
            <input
              type="number"
              min={1}
              max={180}
              value={pendingSettings.focusMinutes}
              onChange={(event) => {
                const value = Math.max(1, Math.min(180, Number(event.target.value) || 1))
                setPendingSettings({
                  ...pendingSettings,
                  focusMinutes: value
                })
              }}
            />
          </div>
          <div className="field">
            <label>短休息（分鐘）</label>
            <input
              type="number"
              min={1}
              max={60}
              value={pendingSettings.shortBreakMinutes}
              onChange={(event) => {
                const value = Math.max(1, Math.min(60, Number(event.target.value) || 1))
                setPendingSettings({
                  ...pendingSettings,
                  shortBreakMinutes: value
                })
              }}
            />
          </div>
          <div className="field">
            <label>長休息（分鐘）</label>
            <input
              type="number"
              min={1}
              max={120}
              value={pendingSettings.longBreakMinutes}
              onChange={(event) => {
                const value = Math.max(1, Math.min(120, Number(event.target.value) || 1))
                setPendingSettings({
                  ...pendingSettings,
                  longBreakMinutes: value
                })
              }}
            />
          </div>
          <div className="field">
            <label>每幾輪長休息</label>
            <input
              type="number"
              min={2}
              max={20}
              value={pendingSettings.longBreakEvery}
              onChange={(event) => {
                const value = Math.max(2, Math.min(20, Number(event.target.value) || 2))
                setPendingSettings({
                  ...pendingSettings,
                  longBreakEvery: value
                })
              }}
            />
          </div>
        </div>
        <div className="grid">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={pendingSettings.autoStartBreaks}
              onChange={(event) =>
                setPendingSettings({
                  ...pendingSettings,
                  autoStartBreaks: event.target.checked
                })
              }
            />
            自動開始休息
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={pendingSettings.autoStartFocus}
              onChange={(event) =>
                setPendingSettings({
                  ...pendingSettings,
                  autoStartFocus: event.target.checked
                })
              }
            />
            自動開始專注
          </label>
        </div>
        <div className="button-row">
          <button className="primary" onClick={updateSettings} disabled={saving}>
            {saving ? '儲存中...' : '儲存設定'}
          </button>
        </div>
      </section>

      <section className="card fade-up" style={{ animationDelay: '0.08s' }}>
        <h2>群組</h2>
        <div className="list">
          {groups.length === 0 ? (
            <p className="muted">尚未建立群組</p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="list-item">
                <input
                  type="text"
                  value={group.name}
                  onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                />
                <input
                  type="color"
                  value={group.color}
                  onChange={(event) => updateGroup(group.id, { color: event.target.value })}
                />
                <button className="ghost" onClick={() => removeGroup(group.id)}>
                  移除
                </button>
              </div>
            ))
          )}
        </div>
        <div className="list-item">
          <input
            type="text"
            placeholder="新增群組名稱"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
          />
          <input
            type="color"
            value={newGroupColor}
            onChange={(event) => setNewGroupColor(event.target.value)}
          />
          <button className="primary" onClick={addGroup}>
            新增
          </button>
        </div>
      </section>

      <section className="card fade-up" style={{ animationDelay: '0.16s' }}>
        <h2>標籤</h2>
        <div className="list">
          {tags.length === 0 ? (
            <p className="muted">尚未建立標籤</p>
          ) : (
            tags.map((tag) => (
              <div key={tag.id} className="list-item">
                <input
                  type="text"
                  value={tag.name}
                  onChange={(event) => updateTag(tag.id, { name: event.target.value })}
                />
                <input
                  type="color"
                  value={tag.color}
                  onChange={(event) => updateTag(tag.id, { color: event.target.value })}
                />
                <button className="ghost" onClick={() => removeTag(tag.id)}>
                  移除
                </button>
              </div>
            ))
          )}
        </div>
        <div className="list-item">
          <input
            type="text"
            placeholder="新增標籤名稱"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
          />
          <input
            type="color"
            value={newTagColor}
            onChange={(event) => setNewTagColor(event.target.value)}
          />
          <button className="primary" onClick={addTag}>
            新增
          </button>
        </div>
      </section>

      <section className="card fade-up" style={{ animationDelay: '0.24s' }}>
        <h2>待辦清單</h2>
        <div className="list">
          {todos.length === 0 ? (
            <p className="muted">尚未建立待辦</p>
          ) : (
            todos.map((todo) => (
              <div key={todo.id} className="todo-row">
                <input
                  type="text"
                  value={todo.title}
                  onChange={(event) => updateTodo(todo.id, { title: event.target.value })}
                />
                <input
                  type="number"
                  min={1}
                  value={todo.plannedPomodoros}
                  onChange={(event) =>
                    updateTodo(todo.id, {
                      plannedPomodoros: Math.max(1, Number(event.target.value) || 1),
                      isCompleted:
                        todo.completedPomodoros >= Math.max(1, Number(event.target.value) || 1)
                    })
                  }
                />
                <span className="todo-progress-text">
                  {todo.completedPomodoros}/{todo.plannedPomodoros}
                </span>
                <button className="ghost" onClick={() => removeTodo(todo.id)}>
                  移除
                </button>
              </div>
            ))
          )}
        </div>
        <div className="todo-row">
          <input
            type="text"
            placeholder="新增任務名稱"
            value={newTodoTitle}
            onChange={(event) => setNewTodoTitle(event.target.value)}
          />
          <input
            type="number"
            min={1}
            value={newTodoPomodoros}
            onChange={(event) => setNewTodoPomodoros(Math.max(1, Number(event.target.value) || 1))}
          />
          <span className="todo-progress-text">0/{newTodoPomodoros}</span>
          <button className="primary" onClick={addTodo}>
            新增
          </button>
        </div>
        <p className="muted">完成一個專注階段會自動累計此任務的番茄鐘。</p>
      </section>

      <section className="card fade-up" style={{ animationDelay: '0.32s' }}>
        <h2>Google Drive 同步</h2>
        <div className="grid">
          <div className="field">
            <label>資料夾路徑</label>
            <input
              type="text"
              value={pendingDrive.folderPath}
              onChange={(event) =>
                setPendingDrive({
                  ...pendingDrive,
                  folderPath: event.target.value
                })
              }
            />
          </div>
          <div className="field">
            <label>檔名</label>
            <input
              type="text"
              value={pendingDrive.fileName}
              onChange={(event) =>
                setPendingDrive({
                  ...pendingDrive,
                  fileName: event.target.value
                })
              }
            />
          </div>
        </div>
        <p className="muted">上次同步：{pendingDrive.lastSyncAt ? new Date(pendingDrive.lastSyncAt).toLocaleString() : '尚未同步'}</p>
        <div className="button-row">
          <button className="ghost" onClick={updateDriveConfig} disabled={saving}>
            儲存位置
          </button>
          <button className="primary" onClick={syncToDrive} disabled={syncing}>
            {syncing ? '同步中...' : '同步到 Drive'}
          </button>
          <button className="ghost" onClick={syncFromDrive} disabled={syncing}>
            從 Drive 覆蓋本機
          </button>
        </div>
        <p className="muted">
          路徑支援層級格式，例如：Pomodoro/工作/專案。
        </p>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}

export default OptionsApp
