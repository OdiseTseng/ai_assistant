# Odise Gemini Assistant

一個基於 Google Gemini API 的個人助理網頁，整合了交通資訊查詢功能。

## 功能特色
- **交通時刻查詢**：火車、公車、YouBike (自定義站點)。
- **GPS 定位**：自動抓取當前位置以提供最近站點資訊。
- **自動版本號**：每次 Git Commit 自動注入更新時間。

## 如何使用
1. **設定 API Key**：
   - 前往 [Google AI Studio](https://aistudio.google.com/) 申請 API Key。
   - 在網頁上方輸入 Key 並點擊「儲存」。
   - *注意：Key 僅儲存在您的瀏覽器 LocalStorage 中，不會上傳至伺服器。*

2. **新增站點**：
   - 點擊各區塊的「+」按鈕。
   - **火車**：可透過左側縣市選單或上方搜尋框尋找站點。
   - **公車/YouBike**：直接在搜尋框輸入站點名稱 (如 "307", "捷運板橋站")，並點擊「新增」。

3. **發送查詢**：
   - 點擊右下角的「取得 GPS 並發送查詢」。
   - 允許瀏覽器定位權限。
   - Gemini 將會根據您的站點列表與位置回覆資訊。

## 常見問題
- **Q: 頁面一直提示「尚未偵測到金鑰」？**
  - 請確認您有點擊綠色的「儲存」按鈕。
  - **如果您使用 VS Code 的 Preview 功能**：某些 Preview 模式無法保存資料 (LocalStorage)。建議直接用電腦的 **Chrome 瀏覽器** 開啟 `index.html` 檔案。

- **Q: 為什麼 GPS 沒反應？**
  - 請確認瀏覽器有允許網頁存取位置權限。
  - 需要在 `https` 或 `file://` (本地檔案) 環境下執行。

## 開發資訊
- 使用 `pre-commit` hook 自動更新 `version.js`。
