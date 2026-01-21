# Playwright E2E 測試使用指南

本專案使用 [Playwright](https://playwright.dev/) 進行端對端 (End-to-End) 測試。以下說明如何建置環境、執行測試與檢視報告。

## 1. 環境準備 (Setup)

首次執行前，請確保已安裝 Node.js (推薦 v18+)，並在專案根目錄安裝依賴：

```bash
# 安裝專案依賴 (包含 Playwright)
npm install

# 安裝 Playwright 瀏覽器執行檔 (Chromium, Firefox, WebKit)
npx playwright install
```

## 2. 執行測試 (Running Tests)

我們提供多種方式來執行測試，視您的需求選擇：

### 🅰️ 圖形介面模式 (UI Mode) - **開發與除錯推薦**
這是最直觀的方式，提供類似 IDE 的介面，可以即時觀看測試執行、查看每一步驟的 DOM Snapshot 與 Log。

```bash
npx playwright test --ui
```
*   指令執行後會彈出一個視窗。
*   點擊左側列表旁的 ▶ 按鈕即可執行測試。
*   使用上方工具列的 "Watch" (眼睛圖示) 可在存檔時自動重跑。

### 🅱️ 終端機模式 (Headless / CLI) - **快速驗證 / CI 使用**
在背景執行測試，不開啟瀏覽器視窗。

```bash
# 執行所有測試
npx playwright test

# 僅執行特定檔案
npx playwright test tests/e2e/index.spec.js

# 指定瀏覽器 (預設跑所有設定的瀏覽器)
npx playwright test --project=chromium
```

### 🆑 Docker 執行 (選用)
若本機環境無法運作，可透過 Docker 執行：

```bash
docker compose run --rm playwright npm run test:e2e
```

## 3. 檢視測試報告 (Test Reports)

測試完成後，Playwright 預設會產生 HTML 報告。

### 如果測試失敗 (自動開啟)
通常測試失敗時，CLI 會自動提示是否開啟報告。

### 手動開啟報告
無論測試成功或失敗，您都可以隨時執行以下指令來檢視最近一次的報告：

```bash
npx playwright show-report
```
這會在您的瀏覽器中開啟一個本地網頁，展示詳細的測試結果、錯誤堆疊 (Stack Trace) 以及失敗時的截圖或錄影。

## 4. 常見問題與除錯

*   **測試顯示 `ETIMEDOUT` 或連線失敗？**
    *   Playwright 會嘗試自動啟動 `npm run start` (Port 5500)。若失敗，請檢查 Port 5500 是否被佔用，或嘗試手動先啟動伺服器。
*   **如何看到除錯訊息？**
    *   在 UI 模式下，下方 Console 分頁會顯示 `console.log` 內容。
    *   在 CLI 模式下，報告中的 "Stdout" 分頁可查看 Log。
