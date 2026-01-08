import { useEffect, useMemo, useState } from 'react'
import { STORAGE_KEY } from '../lib/data'
import { sendMessage } from '../lib/messages'
import { getPhaseDurationSeconds } from '../lib/timer'
import type { PomodoroData, PomodoroTag } from '../lib/types'

const phaseLabels: Record<string, string> = {
  focus: '專注',
  shortBreak: '短休息',
  longBreak: '長休息',
  idle: '待命'
}

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getTagName = (tag: PomodoroTag) => tag.name || '未命名'

const PopupApp = () => {
  const [data, setData] = useState<PomodoroData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const response = await sendMessage({ type: 'getData' })
      if (!mounted) return
      if (response.ok) {
        setData(response.data)
      } else {
        setError(response.error)
      }
    }
    load()
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && changes[STORAGE_KEY]?.newValue) {
        setData(changes[STORAGE_KEY].newValue)
      }
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => {
      mounted = false
      window.clearInterval(interval)
      chrome.storage.onChanged.removeListener(onChanged)
    }
  }, [])

  const remainingSeconds = useMemo(() => {
    if (!data) return 0
    if (data.state.isRunning && data.state.targetEndAt) {
      return Math.max(0, Math.floor((data.state.targetEndAt - now) / 1000))
    }
    return data.state.secondsRemaining
  }, [data, now])

  const totalSeconds = useMemo(() => {
    if (!data) return 1
    return getPhaseDurationSeconds(data.state.currentPhase, data.settings)
  }, [data])

  const progressDegree = useMemo(() => {
    const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0
    return Math.max(0, Math.min(360, Math.round(progress * 360)))
  }, [remainingSeconds, totalSeconds])

  const toggleTimer = async () => {
    if (!data) return
    const response = await sendMessage({
      type: data.state.isRunning ? 'timerPause' : 'timerStart'
    })
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const skipPhase = async () => {
    const response = await sendMessage({ type: 'timerSkip' })
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const resetTimer = async () => {
    const response = await sendMessage({ type: 'timerReset' })
    if (!response.ok) {
      setError(response.error)
      return
    }
    setData(response.data)
  }

  const setActiveGroup = async (groupId: string) => {
    const payload = groupId === 'none' ? undefined : groupId
    const response = await sendMessage({ type: 'setActiveGroup', payload })
    if (response.ok) {
      setData(response.data)
    }
  }

  const toggleTag = async (tagId: string) => {
    if (!data) return
    const active = new Set(data.state.activeTagIds)
    if (active.has(tagId)) {
      active.delete(tagId)
    } else {
      active.add(tagId)
    }
    const response = await sendMessage({
      type: 'setActiveTags',
      payload: Array.from(active)
    })
    if (response.ok) {
      setData(response.data)
    }
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
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

  if (!data) {
    return (
      <div className="app">
        <div className="card">
          <p className="muted">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">雲端番茄鐘</p>
          <h1>專注節奏</h1>
        </div>
        <button className="ghost" onClick={openOptions}>
          設定
        </button>
      </header>

      <section className="card timer-card fade-up">
        <div
          className="timer-ring"
          style={{
            background: `conic-gradient(var(--accent) ${progressDegree}deg, rgba(255,255,255,0.2) 0deg)`
          }}
        >
          <div className="timer-inner">
            <p className="phase-label">{phaseLabels[data.state.currentPhase]}</p>
            <div className="timer-value">{formatTime(remainingSeconds)}</div>
            <p className="muted">第 {data.state.cycleCount + 1} 輪</p>
          </div>
        </div>

        <div className="button-row">
          <button className="primary" onClick={toggleTimer}>
            {data.state.isRunning ? '暫停' : '開始'}
          </button>
          <button className="ghost" onClick={skipPhase}>
            跳過
          </button>
          <button className="ghost" onClick={resetTimer}>
            重置
          </button>
        </div>
      </section>

      <section className="card fade-up" style={{ animationDelay: '0.08s' }}>
        <h2>分類</h2>
        <div className="field">
          <label>群組</label>
          <select
            value={data.state.activeGroupId ?? 'none'}
            onChange={(event) => setActiveGroup(event.target.value)}
          >
            <option value="none">不指定</option>
            {data.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || '未命名'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>標籤</label>
          <div className="tag-grid">
            {data.tags.length === 0 ? (
              <p className="muted">尚未建立標籤</p>
            ) : (
              data.tags.map((tag) => {
                const active = data.state.activeTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag ${active ? 'active' : ''}`}
                    style={{ borderColor: tag.color, color: tag.color }}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {getTagName(tag)}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </section>

      <section className="card fade-up" style={{ animationDelay: '0.16s' }}>
        <h2>雲端同步</h2>
        <p className="muted">
          位置：{data.driveConfig.folderPath}/{data.driveConfig.fileName}
        </p>
        <p className="muted">
          上次同步：{data.driveConfig.lastSyncAt ? new Date(data.driveConfig.lastSyncAt).toLocaleString() : '尚未同步'}
        </p>
        <div className="button-row">
          <button className="primary" onClick={syncToDrive} disabled={syncing}>
            {syncing ? '同步中...' : '同步到 Drive'}
          </button>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}

export default PopupApp
