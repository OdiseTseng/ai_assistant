# 專案與客戶分析報告 (Project Analysis)

## 1. 客戶畫像分析 (Customer Persona Analysis)

根據 `conversation_history.md` 的互動記錄，我們歸納出的客戶畫像如下：

*   **角色定位**：
    *   **技術型專案經理 (Technical PM) 或 資深開發者 (Senior Developer)**：客戶熟悉軟體開發流程 (SDLC)，了解 Git、Docker、Playwright、Maven 等技術名詞，並主動要求產出 BRD/PRD/SDD 等標準文件，顯示其具備專業背景。
    *   **細節與品質追求者**：對 UI/UX 有高度要求（如「黑色玻璃風格」、「動態文字」、「操作流暢度」），且關注系統穩定性（如 503 錯誤處理、API Key 檢查）。

*   **行為特徵**：
    *   **目標導向**：清楚知道自己要解決的問題（通勤最後一哩路、回老家路線規劃）。
    *   **漸進式需求 (Iterative)**：從單一功能開始，逐步追加「回老家」、「想去哪」、「YouBike 整合」、「假日邏輯」等功能。
    *   **依賴 AI 協作**：雖然懂技術，但依賴 AI 編寫具體程式碼（JS/CSS）與文件，自己則專注於架構把關與測試驗證。

*   **心理預期**：
    *   希望產品不僅是「能用」，更要「好用」且「好看」（Premium feel）。
    *   重視「自動化」與「智慧化」（如自動判斷地點、自動切換分頁）。

## 2. 預期落差分析 (Gap Analysis)

| 比較項目 | 第一版網頁 (The First Version) | 客戶預期 (Customer Expectations) | 落差程度 (Gap) |
| :--- | :--- | :--- | :--- |
| **視覺體驗** | 基礎 HTML/CSS，功能導向，介面樸素。 | **Premium 級別**：玻璃擬態 (Glassmorphism)、流暢動畫、RWD 響應式、深色模式、客製化 Scrollbar。 | **高 (High)**：需大量 CSS 重構與 UI 優化。 |
| **功能深度** | 單純的 A 到 B 路線查詢。 | **智慧助理等級**：包含「日常通勤/回老家/自訂」多分頁、自動判斷假日/位置、YouBike 即時資訊、天氣整合。 | **高 (High)**：需複雜的狀態管理 (State Management) 與多 API 串接。 |
| **穩定性** | 容易受 API 波動影響，缺乏錯誤引導。 | **企業級韌性**：具備 503 錯誤攔截、Loading 狀態提示、API Key 防呆、完整的 Debug Console。 | **中 (Medium)**：需增強錯誤處理邏輯。 |
| **部署與維運** | 本地檔案開啟 (`file://`)。 | **工程化標準**：Docker 容器化、Playwright 自動化測試、CI/CD 整合、Git 版本控制。 | **中 (Medium)**：需建立完整的 DevOps 流程。 |

**總結**：
第一版本的網頁僅達到 POC (概念驗證) 階段，而客戶期望的是一個 **MVP (最小可行性產品) 甚至 Alpha Release 等級** 的應用程式。這中間的落差主要體現在「使用者體驗 (UX) 的細膩度」與「軟體工程的嚴謹度」上。
