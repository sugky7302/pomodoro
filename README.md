# Pomodoro 雲端番茄鐘擴充功能

## 功能
- 可設定專注、短休息、長休息與長休息週期
- 支援群組與標籤分類
- 使用 Google Drive 同步 `pomodoro-data.json`
- 支援在 UI 指定雲端資料夾路徑與檔名

## 開發與建置
```bash
npm install
npm run build
```

## 載入到 Chrome / Edge
1. 開啟瀏覽器的擴充功能管理頁面
2. 開啟「開發人員模式」
3. 選擇「載入未封裝項目」並指向 `dist/`

## Google Drive OAuth 設定
1. 在 Google Cloud Console 建立 OAuth 2.0 用戶端（Chrome 擴充功能類型）
2. 在允許的擴充功能 ID 中加入此擴充功能的 ID
3. 複製 `public/manifest.example.json` 為 `public/manifest.json`
4. 將 Client ID 填入 `public/manifest.json` 的 `oauth2.client_id`

**注意**：請勿將包含真實 Client ID 的 `manifest.json` 提交到版本控制系統

## 同步檔案位置
- 預設：`Pomodoro/pomodoro-data.json`
- 可在「設定中心 → Google Drive 同步」自訂資料夾路徑與檔名

## 注意事項
- Drive 權限使用 `drive.file`，僅能管理由此擴充功能建立或開啟的檔案
- 計時器依背景服務與時間戳維持，瀏覽器休眠時可能延遲切換提示
