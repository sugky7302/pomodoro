## 項目上下文摘要（drive-sync）
生成時間：2026-01-08 12:19:40

### 1. 相似實現分析
- **實現1**: src/background.ts
  - 模式：背景服務處理 Drive 同步與回傳 UI
  - 可復用：handleMessage 的同步入口與錯誤處理
  - 需注意：同步流程需保持 sendResponse 回傳

- **實現2**: src/lib/drive.ts
  - 模式：封裝 Drive API（資料夾與檔案存取）
  - 可復用：ensureFolderPath、syncToDrive、syncFromDrive
  - 需注意：授權失敗會拋出錯誤

- **實現3**: src/lib/driveAuth.ts
  - 模式：使用 chrome.identity 取得 OAuth 權杖
  - 可復用：getDriveToken 與權杖清除流程
  - 需注意：Edge/不支援 identity 時需要替代流程

- **開源實現A**: repo://nightcodex7/bookdrive-extension/358ac37bcddfc6b215ae0b645cb2abe364868136/contents/src/lib/auth/drive-auth.js
  - 模式：token 取得與 refresh 邏輯
  - 可復用：授權失敗時的錯誤處理策略
  - 需注意：該實作包含 fallback 流程，需簡化以符合本專案

### 2. 項目約定
- **命名約定**: 檔案/資料夾小寫，程式碼 camelCase / PascalCase
- **文件組織**: `src/lib` 封裝授權與 API、`src/background` 負責調用
- **導入順序**: 外部套件 → 內部模組
- **代碼風格**: TypeScript 明確型別

### 3. 可復用組件清單
- `src/lib/drive.ts`: Drive API 封裝
- `src/lib/driveAuth.ts`: OAuth 權杖取得
- `src/lib/messages.ts`: UI 與背景通訊

### 4. 測試策略
- **測試框架**: Vitest
- **測試模式**: 單元測試
- **參考文件**: src/lib/drive.test.ts
- **覆蓋要求**: 授權 fallback 與訊息回應

### 5. 依賴和集成點
- **外部依賴**: Chrome Identity API、Google OAuth
- **內部依賴**: background.ts 同步流程
- **集成方式**: chrome.identity.getAuthToken / launchWebAuthFlow
- **配置來源**: public/manifest.json oauth2

### 6. 技術選型理由
- **為什麼用這個方案**: 先使用標準 getAuthToken，失敗時啟用授權視窗
- **優勢**: 提升 Edge 相容性，保留 Chrome 原生流程
- **劣勢和風險**: 授權視窗流程需解析 URL 並管理權杖快取

### 7. 關鍵風險點
- **併發問題**: 多次同步可能造成重複授權視窗
- **邊界條件**: OAuth 回傳缺少 access_token
- **性能瓶頸**: 無
- **安全考慮**: 仍遵循 OAuth 流程，不存取多餘權限

### 8. 限制與替代
- sequential-thinking / shrimp-task-manager / context7 / desktop-commander 不可用，改以手動流程與日誌留痕
