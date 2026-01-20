# 測試計畫與報告 (Test Plan & Report)

**文件名稱**: Test_Plan_And_Report.md
**適用對象**: QA 工程師、客戶
**版本**: 1.0

---

## 1. 測試目標 (Test Objectives)
確保 AI 通勤助手在不同裝置、瀏覽器上皆能穩定運作，且關鍵功能（API 連線、資料渲染、錯誤處理）符合預期。重點驗證 **Playwright E2E 自動化測試** 與 **手動邊界測試**。

## 2. 測試範圍 (Test Scope)
*   **功能測試 (Functional Testing)**:
    *   儀表板分頁切換 (Commute / Old Home / Custom)。
    *   設定視窗 CRUD (Create, Read, Update, Delete)。
    *   地圖搜尋 (Nominatim) 與 結果選擇。
*   **API 整合測試 (Integration Testing)**:
    *   Gemini API 回應解析與錯誤處理 (503)。
    *   YouBike API 資料獲取。
*   **介面測試 (UI/UX Testing)**:
    *   RWD 響應式佈局 (Mobile/Desktop)。
    *   Modal 視窗開關與 Z-Index 疊加。

## 3. 測試環境 (Test Environment)
*   **OS**: Windows 10/11
*   **Browser**: Chrome (Latest), Edge
*   **Tools**: Playwright (v1.x), Node.js, Localhost Server (Live Server)

## 4. 測試案例 (Test Cases)

### 4.1 自動化測試 (Playwright)
| ID | 測試名稱 | 預期結果 | 狀態 |
| :--- | :--- | :--- | :--- |
| TC-Auto-01 | `index.spec.js` - Page Load | 頁面標題正確，主要 UI 元素可見 | ✅ Pass |
| TC-Auto-02 | `index.spec.js` - Tab Switching | 點擊不同 Tab 能顯示對應內容區塊 | ✅ Pass |
| TC-Auto-03 | `sidebar.spec.js` - Mobile Menu | 手機模式下漢堡選單可展開/收合 | ✅ Pass |
| TC-Auto-04 | `modal.spec.js` - Settings Modal | 設定視窗可開啟，並且能輸入 API Key | ⚠️ Fixed |

### 4.2 手動驗證重點
*   **情境 1：無 API Key 啟動**
    *   步驟：清除 LocalStorage 後重新整理。
    *   預期：應自動彈出「歡迎使用」設定視窗，且背景不可操作。
*   **情境 2：回老家查詢**
    *   步驟：切換至「回老家」Tag，點擊「回家囉」。
    *   預期：Console 顯示 old_home 相關 Prompt，並產生路線建議。
*   **情境 3：模擬 503 錯誤**
    *   步驟：在 Debug Console 模擬 API 回傳 503。
    *   預期：UI 顯示紅色錯誤訊息「AI現正忙碌中...」。

## 5. Bug 修復報告 (Bug Fix Report)
*   **[Fixed] Z-Index Issue**: 最後一哩路選擇視窗曾被設定視窗遮擋，已透過新增 `.modal-overlay-top` class (z-index: 2001) 修復。
*   **[Fixed] Nested JSON Parsing**: 修正 AI 回傳巢狀 `stations` 物件導致解析失敗的問題。
*   **[Fixed] Mobile Sidebar**: 修正手機版側邊欄無法關閉的問題，新增了關閉按鈕與背景點擊關閉。
*   **[Fixed] API 503**: 實作了針對 `Model Overloaded` 的錯誤攔截與友善提示。

## 6. 結論 (Conclusion)
目前核心功能穩定，自動化測試覆蓋率逐步提升。建議在下個版本加強對 YouBike 缺車狀態的邊界測試 (Edge Case)。
