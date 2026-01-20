# Index Page 測試案例清單

## Sidebar Component
- [ ] 點擊 Menu Button 應該開啟 Sidebar
- [ ] 點擊 Overlay 應該關閉 Sidebar
- [ ] 點擊 Sidebar 內的 "儀表板" 連結應該導航至 Dashboard
- [ ] 點擊 Sidebar 內的 "個人化設定" 連結應該開啟 Settings Modal
- [ ] 點擊 Sidebar 內的 "說明文件" 連結應該開啟 Help Modal

## Dashboard Interaction
- [ ] 預設應顯示 "日常通勤" (Daily) 分頁
- [ ] 點擊 "回老家" 按鈕應切換至 Old Home 分頁並隱藏其他分頁
- [ ] 點擊 "想去哪?" 按鈕應切換至 Custom 分頁並隱藏其他分頁
- [ ] 切換分頁後，分頁按鈕應顯示 active 狀態

## Daily Commute Logic
- [ ] "日常通勤" 分頁應包含 "最佳轉乘方案" 區塊
- [ ] "根據設定取得 GPS 並查詢" 按鈕預設應為禁用狀態 (disabled)
- [ ] "火車", "捷運", "公車", "YouBike" 列表區塊應正確顯示

## Old Home Logic
- [ ] "回老家" 分頁應包含 "回老家規劃" 區塊
- [ ] "回家囉" 按鈕默認應為禁用狀態 (disabled)

## Custom Route Logic
- [ ] "想去哪?" 分頁應包含目的地輸入框
- [ ] 輸入目的地文字後應可進行搜尋
- [ ] 交通工具偏好設定 checkboxes 應可被勾選或取消

## Station Modal
- [ ] 點擊 "新增站點 (+)" 按鈕應開啟 Station Modal
- [ ] 在 Station Modal 搜尋框輸入文字應觸發搜尋過濾
- [ ] 點擊 Modal 關閉按鈕 (X) 應關閉 Station Modal

## Settings Modal
- [ ] Settings Modal 開啟時應預設顯示 "平日設定"
- [ ] 切換至 "假日設定" 應顯示對應的輸入欄位
- [ ] 輸入 API Key 欄位應存在且為 password 類型

## Initialization
- [ ] 若 localStorage 中無 API Key，頁面載入後應自動顯示 Init Prompt Modal
