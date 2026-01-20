# AI 專案實作指揮指南 (Implementation Command Guide)

這份文件是專為**指揮 AI Agent (如我)** 所設計的 Prompt 清單。若您希望重新實作一個與 `Antigravity AI Assistant` 功能 80% 相似的應用程式，請依序輸入以下指令。

**核心策略**：不要一次要求「做完整個 App」，而是採用「分階段迭代 (Incremental Development)」的方式。

---

## 階段 0：載入上下文 (Context Loading)
**目的**：確保 AI 理解需求與架構，避免自由發揮導致偏離目標。

> **指令 (Prompt)：**
> 「請先閱讀專案中的 `PRD.md` (產品需求文件) 與 `SDD.md` (系統設計文件)。閱讀完畢後，請告訴我你對這個專案的理解，特別是『儀表板分頁』與『AI 路線規劃』這兩個核心功能的運作邏輯。請不要開始寫程式，先確認需求。」

---

## 階段 1：專案骨架與基礎設施 (Setup & Infrastructure)
**目的**：建立檔案結構與基礎設定。

> **指令 (Prompt)：**
> 「我們現在開始開發。請根據 `SDD.md` 的建議，建立專案的基礎檔案結構：
> 1. `index.html`: 包含基本的 HTML5 結構與 viewport 設定。
> 2. `style.css`: 預先定義變數 (CSS Variables) 用於深色主題顏色。
> 3. `script.js`: 建立空的 DOMContentLoaded 監聽器。
> 4. `api_service.js`: 建立空的 class 或模組結構。
>
> 請產出這些檔案，確保它們之間已正確連結 (link/script tag)。」

---

## 階段 2：高質感 UI 實作 (UI Implementation)
**目的**：先視覺後邏輯，確保滿足「Premium Feel」的設計要求。

> **指令 (Prompt)：**
> 「現在進行 UI 開發。請參考 `PRD.md` 的『非功能需求』，使用 Vanilla CSS 實作『黑色玻璃擬態 (Dark Glassmorphism)』風格。
>
> 請在 `index.html` 與 `style.css` 中實作：
> 1. **側邊欄 (Sidebar)**：包含『日常通勤』、『回老家』、『想去哪』三個選單按鈕。
> 2. **主儀表板 (Main Dashboard)**：使用 Grid 或 Flex 佈局。
> 3. **四大資訊卡片**：火車、捷運、公車、YouBike，需有半透明背景與模糊效果 (`backdrop-filter: blur`)。
>
> 請先專注於靜態畫面的 RWD 排版，暫時不需要 JS 互動。」

---

## 階段 3：核心邏輯與分頁系統 (Core Logic)
**目的**：實作不需要 AI 介入的純前端邏輯。

> **指令 (Prompt)：**
> 「接下來實作前端邏輯。請編輯 `script.js`：
> 1. 實作 **分頁切換功能 (`switchDashboardTab`)**：點擊側邊欄按鈕時，主畫面需切換顯示對應標題（日常通勤/回老家/想去哪）。
> 2. 實作 **設定視窗 (Settings Modal)**：點擊設定圖示可開啟視窗，輸入 API Key 與起訖點地址，並將資料儲存到 `localStorage`。
> 3. 實作 **狀態初始化**：頁面載入時，從 `localStorage` 讀取並還原設定。」

---

## 階段 4：AI 服務整合 (API Integration)
**目的**：串接大腦 (Gemini) 與地圖搜尋。

> **指令 (Prompt)：**
> 「現在我們要整合 AI。請編輯 `api_service.js` 與 `script.js`：
> 1. 在 `api_service.js` 中實作 `callGeminiAPI(prompt)`，需包含 Error Handling (特別是 503 錯誤)。
> 2. 設計一個函數 `generateCommutePrompt(settings)`，根據使用者設定（住家/公司）與當前時間，組合成給 AI 的 Prompt。
> 3. 在 `script.js` 中將『出發』按鈕綁定上述流程：點擊 -> 組裝 Prompt -> 呼叫 API -> 取得 JSON 回應。」

---

## 階段 5：結果渲染與地圖 (Rendering & Map)
**目的**：將 AI 的文字回應轉化為漂亮介面。

> **指令 (Prompt)：**
> 「即使 AI 回傳了資料，使用者還看不到。請實作渲染邏輯：
> 1. 編輯 `script.js` 的 `renderItineraries(data)`：將 JSON 中的步驟解析為 HTML 列表，交通工具 (Bus/MRT) 需對應顯示 Icon。
> 2. 整合 **Nominatim API**：在『想去哪』分頁實作地點搜尋，當使用者輸入地點時，先呼叫 OpenStreetMap API 驗證地點存在，再傳給 AI 規劃。」

---

## 階段 6：驗證與修飾 (Refine & Polish)
**目的**：補足 80% 到 100% 的差距（防呆、動畫、體驗）。

> **指令 (Prompt)：**
> 「最後進行優化：
> 1. **Loading 狀態**：API 回應時，按鈕需顯示『🤖 規劃中...』並鎖定。
> 2. **自動導向**：根據現在時間（平日上班/假日），開啟網頁時自動切換到正確分頁。
> 3. **錯誤與提示**：若無 API Key，請彈出視窗提醒使用者。」

---

## 給使用者的建議
*   **分步執行**：每次只執行一個階段，確認該階段功能正常（例如 UI 沒跑版、按鈕有反應）後，再進入下一階段。
*   **提供錯誤訊息**：如果實作過程中報錯，直接把 Console 的紅字錯誤複製給 AI，要求它「Fix this error based on the script.js logic」。
