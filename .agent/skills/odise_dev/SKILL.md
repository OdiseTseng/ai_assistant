---
name: odise_dev
description: 專屬於 Odise Gemini Assistant 專案的開發、測試與維護技能規範。
---
# Odise Gemini Assistant Developer Skill

此技能整合了專案的開發規則、測試流程與架構資訊，請在進行任何開發任務前參考此技能。

## 1. 專案行為準則 (Project Rules)

> [!IMPORTANT]
> 違反以下規則將視為嚴重錯誤。

1.  **全繁體中文**：所有的對話、思考過程、產生的文件 (`.md`)、程式碼註釋，必須全程且強制使用 **繁體中文**。
2.  **文件維護**：
    -   對話記錄：隨時更新 `conversation_history.md` (僅需依日期倒敘流水帳，不需條列)。
    -   任務追蹤：使用 `task.md` 與 `implementation_plan.md` 規劃與追蹤進度。
3.  **版本控制**：
    -   在生成 Commit 前，檢查並更新 `version.js` 中的時間戳記 (`BUILD_INFO.time`)。
    -   格式範例：`time: "2026-01-22 10:30:00"` (使用當前時間)。
    -   可使用 `update_version.ps1` 腳本輔助。
4.  **查證求真**：
    -   涉及 API 調用或新功能時，務必使用 **Google Search** 驗證最新資訊。
    -   查不到的資訊請直接回覆「查詢不到」，嚴禁捏造。

## 2. 測試與驗證 (Testing & Verification)

本專案使用 **Playwright** 進行 E2E 測試。

### 常用指令
-   **執行所有測試**：`npm run test:e2e`
-   **查看測試報告**：`npm run report`
-   **啟動本地伺服器**：`npm start` (預設 port 8080 或 5500，請確認 console 輸出)

### 測試檔案結構 (`tests/e2e/`)
-   `dashboard.spec.js`: 測試儀表板顯示與 Tab 切換。
-   `daily_commute.spec.js`: 測試日常通勤 (上班/回家) 邏輯。
-   `old_home.spec.js`: 測試老家通勤邏輯。
-   `custom_route.spec.js`: 測試自訂路線功能。

> [!TIP]
> 修改 UI 或核心邏輯後，務必執行 `npm run test:e2e` 確保沒有 Regression。

## 3. 專案架構與關鍵檔案

-   **核心邏輯**：
    -   `index.html`: 主頁面結構。
    -   `script.js`: 前端主要互動邏輯 (UI 控制、資料流管理)。
    -   `api_service.js`: 負責與 Gemini API 溝通，包含 Prompt 組合邏輯。
    -   `station_data.js`: 定義車站資料 (火車、捷運) 與關鍵字映射。
-   **資料儲存**：
    -   完全依賴瀏覽器 `LocalStorage` 儲存使用者設定 (API Key, 通勤設定)。
    -   無後端資料庫，確保隱私。

## 4. 開發注意事項

-   **API Key 安全**：Key 僅存在 LocalStorage，開發測試時請勿將真實 Key Commit 進 Codebase。
-   **模擬操作**：若需模擬人類操作測試，請加入 2 秒延遲。
-   **RWD 設計**：設計需考量響應式 (Mobile First/Desktop)，樣式主要在 `style.css`。
