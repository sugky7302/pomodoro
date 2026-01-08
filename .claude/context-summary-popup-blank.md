## 項目上下文摘要（popup 空白修正）
生成時間：2026-01-08 12:30:08

### 1. 相似實現分析
- **實現1**: src/popup/PopupApp.tsx:37
  - 模式：Popup 透過 sendMessage + storage.onChanged 同步資料狀態
  - 可復用：normalizeData、sendMessage、getPhaseDurationSeconds
  - 需注意：UI 直接使用 data.todos.find / map，資料缺欄位會造成渲染錯誤

- **實現2**: src/options/OptionsApp.tsx:115
  - 模式：Options UI 以 `data?.todos ?? []` 提供預設陣列避免空值
  - 可復用：useMemo 產生安全列表
  - 需注意：錯誤訊息集中呈現

- **實現3**: src/background.ts:355
  - 模式：Drive 同步在背景完成後存回本機
  - 可復用：normalizeData、saveData
  - 需注意：同步資料需正規化避免缺欄位

### 2. 項目約定
- **命名約定**: 檔案/資料夾小寫，程式碼 camelCase / PascalCase
- **文件組織**: UI 在 `src/popup`/`src/options`，背景服務在 `src/background.ts`
- **導入順序**: 先外部/React，再本地模組，再型別
- **代碼風格**: TypeScript 明確型別，React hook 分段

### 3. 可復用組件清單
- `src/lib/data.ts`: normalizeData / DEFAULT_* 資料正規化
- `src/lib/storage.ts`: loadData / saveData 封裝
- `src/lib/messages.ts`: sendMessage

### 4. 測試策略
- **測試框架**: Vitest
- **測試模式**: 單元測試
- **參考文件**: `src/lib/data.test.ts`、`src/lib/drive.test.ts`
- **覆蓋要求**: 正常流程 + 缺欄位資料正規化

### 5. 依賴和集成點
- **外部依賴**: Chrome extension APIs（storage/runtime/identity/notifications）
- **內部依賴**: background → storage/data/drive
- **集成方式**: UI → sendMessage → background → saveData
- **配置來源**: `public/manifest.json` oauth2

### 6. 技術選型理由
- **為什麼用這個方案**: 使用 normalizeData 保證資料結構完整，避免 UI render 崩潰
- **優勢**: 降低資料缺欄位時的錯誤風險
- **劣勢和風險**: 需確保正規化不覆蓋有效狀態

### 7. 關鍵風險點
- **併發問題**: storage.onChanged 與 UI state 更新時序
- **邊界條件**: Drive 同步返回舊版資料欄位缺失
- **性能瓶頸**: 正規化頻繁呼叫的微小開銷
- **安全考慮**: 無
