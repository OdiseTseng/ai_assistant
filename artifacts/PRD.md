# 產品需求文件 (PRD) - AI 通勤助手

**文件名稱**: Product_Requirement_Document_PRD.md
**適用對象**: 全體專案成員
**版本**: 1.0

---

## 1. 產品概述 (Product Overview)
AI 通勤助手是一款網頁應用程式 (Web App)，利用 Gemini 2.0 Flash 模型強大的自然語言處理能力，結合 OpenStreetMap (Nominatim) 與 YouBike API，為使用者提供「情境化」的交通建議。

## 2. 使用者故事 (User Stories)

| ID | 角色 | 行動 (Action) | 目的/價值 (Benefit) |
| :--- | :--- | :--- | :--- |
| US-01 | 通勤族 | 設定住家與公司位置 | 讓系統能自動規劃每日通勤路線，無需重複輸入。 |
| US-02 | 假日返鄉者 | 點擊「回家囉」按鈕 | 快速獲得回老家的最佳交通組合（高鐵/客運+轉乘）。 |
| US-03 | 遊客 | 輸入「淡水老街」並選擇交通偏好 | 獲得包含捷運與步行時間的完整行程建議。 |
| US-04 | YouBike 使用者 | 在列表查看站點借還車狀態 | 避免前往無車可借或無位可還的站點。 |
| US-05 | 使用者 | 開啟 App 時 | 系統根據平日/假日自動切換至適切的分頁，減少操作步驟。 |

## 3. 功能規格 (Functional Specifications)

### 3.1 儀表板與分頁系統 (Dashboard & Tabs)
*   **F-01 分頁切換**：支援「日常通勤」、「回老家」、「想去哪」三個分頁。
*   **F-02 自動路由**：
    *   平日 (Mon-Fri) 上班時段 (07:00-10:00) & 下班時段 (17:00-20:00) -> 預設顯示「日常通勤」。
    *   假日 (Sat-Sun) 或非通勤時段 -> 預設顯示「想去哪」。

### 3.2 路線規劃核心 (Core Planning)
*   **F-03 AI 整合**：串接 Gemini API，將起訖點、天氣、節日與偏好轉為 Prompt，解析 JSON 回傳結果。
*   **F-04 結果渲染**：將結構化資料渲染為 HTML，包含交通運具圖示 (🚇, 🚌, 🚶) 與時間估算。
*   **F-05 地圖搜尋**：整合 Nominatim API 進行地點搜尋與驗證，支援多結果選單 (Location Selection Modal)。

### 3.3 個人化與設定 (Personalization)
*   **F-06 設定管理**：提供 Modal 設定 API Key、通勤起訖點、最後一哩路偏好。
*   **F-07 快取機制**：使用 LocalStorage 儲存用戶設定、最近一次 GPS 座標 (30分鐘期效)。
*   **F-08 交通偏好**：在「想去哪」分頁提供 Checkbox (火車/公車/捷運/YouBike) 供使用者篩選。

### 3.4 系統狀態與回饋 (System Status)
*   **F-09 Loading 狀態**：顯示「🤖 規劃路線方案中...」或「🔍 搜尋中...」。
*   **F-10 錯誤處理**：攔截 503 Overloaded 錯誤，顯示友善中文提示。

## 4. 非功能需求 (Non-Functional Requirements)
*   **外觀 (UI/UX)**：黑色玻璃擬態風格 (Dark Glassmorphism)，支援 RWD。
*   **相容性**：支援 Chrome, Edge 最新版本。
*   **回應速度**：API Timeout 設定為 30 秒，本地互動需即時 (<100ms)。
