# 系統設計文件 (SDD) - AI 通勤助手

**文件名稱**: System_Design_Document_SDD.md
**適用對象**: 開發人員、架構師
**版本**: 1.0

---

## 1. 系統架構 (System Architecture)
本系統採用 **Client-Side SPA (Single Page Application)** 架構，不依賴後端資料庫，所有狀態儲存於瀏覽器 LocalStorage。

```mermaid
graph TD
    User[使用者] --> UI[前端介面 (HTML/CSS)]
    UI --> Controller[Script.js (Logic Controller)]
    
    subgraph Browser Environment
        Controller --> State[LocalStorage (User Config)]
        Controller --> GPS[Navigator Geolocation API]
    end
    
    subgraph External Services
        Controller -- "REST (JSON)" --> Gemini[Google Gemini API]
        Controller -- "REST (JSON)" --> OSM[Nominatim (Map Search)]
        Controller -- "REST (JSON)" --> YouBike[YouBike 2.0 API]
    end
```

## 2. 模組設計 (Module Design)

### 2.1 前端核心 (`script.js`)
*   **Initialization**: `DOMContentLoaded` 負責載入設定、判斷分頁 (`switchDashboardTab`)。
*   **Event Handling**: `handleSend`, `handleCustomRoute` 處理按鈕事件。
*   **Rendering**: `renderItineraries`, `renderResult` 負責 HTML 動態生成。
*   **State Management**: `state` 物件同步 LocalStorage。

### 2.2 API 服務層 (`api_service.js`)
*   **`callGeminiAPI(prompt)`**: 封裝 Fetch 請求，處理 API Key 與錯誤 (503)。
*   **`searchLocationNominatim(query)`**: 呼叫 OSM API 搜尋地點。
*   **`getYouBikeData()`**: 獲取全台 YouBike 站點資訊並建立 Map 索引。

## 3. 資料模型 (Data Models)

### 3.1 LocalStorage Schema
```json
{
  "gemini_api_key": "string",
  "settings": {
    "home": { "lat": number, "lng": number, "address": "string" },
    "company": { "lat": number, "lng": number, "address": "string" },
    "commute": { "start": "HH:mm", "end": "HH:mm" },
    "holiday": { 
      "homeLastMile": "string (station_id)", 
      "oldHomeLastMile": "string (station_id)" 
    }
  },
  "custom_prefs": {
    "train": boolean,
    "mrt": boolean,
    "bus": boolean,
    "bike": boolean
  }
}
```

### 3.2 AI Response Schema (Expected)
```json
{
  "itineraries": [
    {
      "mode": "string (e.g., 公車+捷運)",
      "duration": "string",
      "steps": [
        { "type": "walk|bus|mrt", "instruction": "string", "duration": "string" }
      ],
      "details": "string (legacy support)"
    }
  ],
  "stations": {
    "mrt": [], "rain": [], "bus": [], "bike": []
  }
}
```

## 4. 介面規範 (Interface Specifications)
*   **CSS Framework**: Vanilla CSS (no external framework).
*   **Color Palette**:
    *   Background: `#1a1a1a` (Dark Gray)
    *   Accent: `#4a90e2` (Blue)
    *   Glass Effect: `background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);`
*   **Z-Index Strategy**:
    *   Base: 0
    *   Modal Overlay: 1000
    *   Top-Level Modal (Source Select): 2001 (解決遮擋問題)
