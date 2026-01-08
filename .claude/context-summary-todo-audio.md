## 項目上下文摘要（todo-audio）
生成時間：2026-01-08 12:00:36

### 1. 相似實現分析
- **實現1**: src/background.ts
  - 模式：背景服務維護計時狀態、完成階段後通知
  - 可復用：handleTimerCompletion + chrome.alarms + notifications
  - 需注意：完成後需更新 sessions 與狀態同步

- **實現2**: src/popup/PopupApp.tsx
  - 模式：popup 透過 sendMessage 存取資料、即時顯示剩餘時間
  - 可復用：狀態訂閱與 UI 更新模式
  - 需注意：UI 以 chrome.storage.onChanged 觸發更新

- **實現3**: src/options/OptionsApp.tsx
  - 模式：設定頁維護清單（群組/標籤）並寫回背景
  - 可復用：清單 CRUD 與 local state 同步方式
  - 需注意：使用 updateGroups/updateTags 進行保存

- **開源實現A**: repo://MetaMask/metamask-extension/0580eee87aeca2c94e6430c6f88fca3e4ec527ce/contents/app/scripts/offscreen.js
  - 模式：offscreen document 建立與存在性檢查
  - 可復用：hasOffscreenDocument 與 createDocument 的流程
  - 需注意：MV3 需要 offscreen permission 與 justification

- **開源實現B**: repo://RheondaO/LifeTrackDash/28d25c6e6528fefbce9486b2dc3fdbc4febeede8/contents/shared/schema.ts
  - 模式：任務/待辦資料結構與完成狀態欄位
  - 可復用：Todo 欄位命名與完成狀態標記
  - 需注意：此為大型 schema，僅採用 todo 結構概念

### 2. 項目約定
- **命名約定**: 檔案與資料夾採小寫與層級命名；程式碼採 camelCase / PascalCase
- **文件組織**: `src/popup`、`src/options`、`src/background`、`src/lib`
- **導入順序**: 外部套件 → 內部模組 → 樣式
- **代碼風格**: TypeScript 明確型別，避免過度抽象

### 3. 可復用組件清單
- `src/lib/timer.ts`: 計時完成與狀態轉換
- `src/lib/storage.ts`: chrome.storage.local 封裝
- `src/lib/messages.ts`: UI 與背景通訊
- `src/lib/data.ts`: 預設資料與正規化流程

### 4. 測試策略
- **測試框架**: Vitest
- **測試模式**: 單元測試
- **參考文件**: src/lib/timer.test.ts, src/lib/data.test.ts, src/lib/storage.test.ts
- **覆蓋要求**: 新增 todo 欄位正規化、完成時累計輪數、offscreen 音效流程採 smoke 測試

### 5. 依賴和集成點
- **外部依賴**: Chrome Extension API (alarms, notifications, offscreen), React
- **內部依賴**: 背景服務統一更新 state、UI 使用 sendMessage
- **集成方式**: chrome.runtime.sendMessage / chrome.storage.onChanged
- **配置來源**: public/manifest.json

### 6. 技術選型理由
- **為什麼用這個方案**: offscreen document 避免背景 service worker 無法播放音效
- **優勢**: 音效與計時邏輯分離、可重用通知流程
- **劣勢和風險**: offscreen API 需要較新 Chromium 版本支援

### 7. 關鍵風險點
- **併發問題**: todo 更新與計時完成同時寫入導致覆蓋
- **邊界條件**: plannedPomodoros 與 completedPomodoros 的上下限
- **性能瓶頸**: 多個 todo 更新時的 storage 寫入頻率
- **安全考慮**: offscreen 權限屬外部依賴必要條件

### 8. 限制與替代
- sequential-thinking / shrimp-task-manager / context7 / desktop-commander 不可用，改以手動流程與記錄補足
