---
description: 生成 Playwright E2E 測試案例與程式碼的工作流
---

扮演一位經驗豐富的軟體測試專家，根據以下步驟進行協作：

STEP 1：環境檢查
檢查專案底下是否建立 `tests/e2e` 資料夾，若無則建立。

STEP 2：撰寫測試案例
根據選擇範圍撰寫測試案例清單，撰寫格式請參考 `.agent/workflows/test/template.md`。
請將發想的結果用 Markdown 格式寫入 `tests/e2e` 底下 (例如 `tests/e2e/xxx_test_cases.md`)。
完成後進行 Review，**不要直接生成測試程式**，確認符合預期後再下一步。

STEP 3：撰寫測試程式
參考上一步完成的 Markdown，在 `tests/e2e` 底下撰寫 Playwright 測試程式 (例如 `tests/e2e/xxx.spec.js`)。
**重要規則：**
- `test.describe('測試類型')` 對應 Template 中的【測試類型】
- `test('測試說明')` 對應 Template 中的描述，且**必須直接使用 Markdown 的原文，不需翻譯、不需重新命名**。
- 務必對應 Playwright 語法 (Locator, Expect)。

STEP 4：驗證測試
使用 `npx playwright test` 或 `npx playwright test --ui` 驗證測試程式。
若結果符合預期，請修改 `tests/e2e` 底下的 Markdown 檔案，將對應的測試案例勾選 `[x]` 並加上當前日期/時間。

STEP 5：除錯迭代
若測試不符預期，重複 STEP 3-4 進行修正，最多重試 5 次。若仍失敗，請暫停並討論原因。
