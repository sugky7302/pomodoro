## 項目上下文摘要（redirect_uri_mismatch 修正）
生成時間：2026-01-08 12:36:48

### 1. 相似實現分析
- **實現1**: src/lib/driveAuth.ts:31
  - 模式：OAuth 權杖取得與 fallback
  - 可復用：buildAuthUrl、parseAuthRedirect、getDriveToken
  - 需注意：授權錯誤回應需轉成可讀訊息

- **實現2**: src/background.ts:345
  - 模式：Drive 同步統一由背景服務處理
  - 可復用：getDriveToken + syncToDrive/syncFromDrive 流程
  - 需注意：錯誤需回傳到 UI 顯示

- **實現3**: src/options/OptionsApp.tsx:91
  - 模式：UI 捕捉同步錯誤並顯示
  - 可復用：sendMessage + error 顯示
  - 需注意：錯誤訊息要可直接指引設定修正

### 2. 項目約定
- **命名約定**: 檔案/資料夾小寫，程式碼 camelCase / PascalCase
- **文件組織**: lib 封裝 API 與 OAuth，background 處理同步
- **導入順序**: React/外部 → 本地模組 → 型別
- **代碼風格**: TypeScript 明確型別，錯誤訊息集中處理

### 3. 可復用組件清單
- `src/lib/driveAuth.ts`: OAuth 權杖與授權流程
- `src/lib/messages.ts`: UI 與背景通訊
- `src/lib/drive.ts`: Drive API 介面

### 4. 測試策略
- **測試框架**: Vitest
- **測試模式**: 單元測試
- **參考文件**: `src/lib/driveAuth.test.ts`
- **覆蓋要求**: 權杖取得成功、fallback、授權錯誤回應

### 5. 依賴和集成點
- **外部依賴**: Chrome identity API、Google OAuth
- **內部依賴**: background → driveAuth → drive
- **集成方式**: UI → sendMessage → background → driveAuth
- **配置來源**: `public/manifest.json` oauth2

### 6. 技術選型理由
- **為什麼用這個方案**: 在授權錯誤時回傳可操作訊息，降低配置排查成本
- **優勢**: UI 直接顯示可用的 redirect URI 與擴充功能 ID
- **劣勢和風險**: 無法直接修正外部 OAuth 配置，只能提示

### 7. 關鍵風險點
- **併發問題**: 無
- **邊界條件**: OAuth 錯誤沒有回傳 redirect URL
- **性能瓶頸**: 無
- **安全考慮**: 無

### 8. 開源參考
- repo://nightcodex7/bookdrive-extension/OAUTH_FLOW_UPDATE.md：授權流程錯誤處理
