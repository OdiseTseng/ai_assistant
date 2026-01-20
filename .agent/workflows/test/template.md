---
description: Playwright E2E 測試案例模板
---

> 狀態：初始為 [ ]、完成為 [x]
> 注意：狀態只能在測試通過後由流程更新。
> 測試類型：UI Component, Interaction, Routing, API Mocking, Validator...

----

## [ ] 【測試類型】測試案例描述 (將作為 test() 名稱)

### 測試步驟 (Actions)
1. **前往頁面/狀態**: `await page.goto(...)`
2. **定位元素**: `page.locator(...)`
3. **執行操作**: Click / Fill / Hover

### 預期結果 (Assertions)
- **驗證**: `await expect(locator).toBeVisible() / toHaveText(...) / toHaveClass(...)`

----
