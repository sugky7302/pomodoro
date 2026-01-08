## 項目上下文摘要（pomodoro-extension）
生成時間：2026-01-08 11:29:09

### 1. 相似實現分析
- **實現1**: repo://schmich/marinara/ede38592441da7a094f87ed69997a26f4f512c28/contents/package/manifest.json
  - 模式：背景腳本 + alarms/notifications + 儲存
  - 可復用：以背景維持計時、通知提醒、設定頁面模式
  - 需注意：Manifest 版本為 MV2，需轉換為 MV3 Service Worker
  - 來源用途：參考權限與背景運作模式

- **實現2**: repo://Bharath-KumarM/pomodoro-website-blocker/2b3dd6d0c16bb0e7cd379c3f6fd0fb3a28ca57d7/contents/manifest.json
  - 模式：MV3 service_worker + action popup + options page
  - 可復用：MV3 的結構與權限配置範式
  - 需注意：原專案權限偏多，需依需求最小化
  - 來源用途：參考 MV3 結構與 entry 配置

- **實現3**: repo://Sulagna-Dutta-Roy/GGExtensions/6fd2832d5b19ca0513a0ab7ced189af81a9452e5/contents/Focus%20Mate/JS/pomodoro.js
  - 模式：前端計時器 + 本地儲存狀態
  - 可復用：以時間差計算剩餘時間、記錄倒數狀態
  - 需注意：僅靠 setInterval 容易被背景暫停影響，需搭配 alarms/時間戳
  - 來源用途：參考計時狀態更新與格式化方式

- **實現4**: repo://nightcodex7/bookdrive-extension/358ac37bcddfc6b215ae0b645cb2abe364868136/contents/src/lib/auth/drive-auth.js
  - 模式：chrome.identity 取得 OAuth token + Drive API 存取
  - 可復用：使用 chrome.identity.getAuthToken 的流程與 Drive API 呼叫
  - 需注意：此實作包含多瀏覽器 fallback 與較完整的 OAuth2 流程
  - 來源用途：參考 Drive 授權與資料夾確保流程

### 2. 項目約定
- **命名約定**: 檔案採 kebab 或資料夾層級命名；程式碼採 camelCase / PascalCase
- **文件組織**: `src/popup`、`src/options`、`src/background`、`src/lib`
- **導入順序**: 外部套件 → 內部模組 → 樣式
- **代碼風格**: TypeScript + 明確型別；避免過度抽象

### 3. 可復用組件清單
- `src/lib/timer.ts`: 計時狀態轉換與倒數計算
- `src/lib/storage.ts`: chrome.storage.local 讀寫封裝
- `src/lib/drive.ts`: Drive 檔案/資料夾存取封裝
- `src/lib/messages.ts`: 前端到背景的訊息 API

### 4. 測試策略
- **測試框架**: Vitest（規劃）
- **測試模式**: 單元測試（計時轉換、路徑解析）
- **參考文件**: 新增 `src/lib/timer.test.ts`
- **覆蓋要求**: 正常流程 + 邊界條件（0 秒、長休息切換）

### 5. 依賴和集成點
- **外部依賴**: React 19、Vite、TypeScript、Chrome Extension API、Google Drive REST v3
- **內部依賴**: 背景服務負責狀態更新與同步；UI 透過訊息讀寫
- **集成方式**: `chrome.runtime.sendMessage`、`chrome.alarms`、`chrome.storage.local`
- **配置來源**: `public/manifest.json`（OAuth 與權限）

### 6. 技術選型理由
- **為什麼用這個方案**: React 19 提供 UI 組件化；Vite 建置多入口；MV3 背景服務處理計時與同步
- **優勢**: UI 與背景解耦、資料同步集中化
- **劣勢和風險**: MV3 service worker 可能休眠；Drive API 需處理 token 失效

### 7. 關鍵風險點
- **併發問題**: UI 與背景同時更新資料造成覆寫
- **邊界條件**: 計時器跨日/被暫停時的剩餘時間
- **性能瓶頸**: 頻繁同步 Drive
- **安全考慮**: OAuth 權限必須配置於 manifest；此部分為外部依賴強制要求
