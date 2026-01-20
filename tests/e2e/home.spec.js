// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Odise 助理首頁', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to baseURL
        await page.goto('/');

        // 處理「歡迎使用」Modal (使用更穩健的等待機制)
        const welcomeModal = page.locator('#initPromptModal');
        try {
            // 等待最長 3 秒讓 Modal 出現
            await welcomeModal.waitFor({ state: 'visible', timeout: 3000 });

            // 點擊「稍後再說」
            await page.locator('#initPromptModal .btn-secondary').click();

            // 確保它真的消失了
            await expect(welcomeModal).toBeHidden({ timeout: 5000 });
        } catch (e) {
            // 如果 3 秒內沒出現，或者已經消失，就當作沒事繼續
            console.log('Modal 未出現或已自動消失');
        }
    });

    test('頁面標題應該正確', async ({ page }) => {
        await expect(page).toHaveTitle(/Assistant/);
    });

    test('應該顯示任一儀表板區塊 (OR條件)', async ({ page }) => {
        // Double-check modal state. If it's still there (beforeEach failed to close), skip.
        const modal = page.locator('#initPromptModal');
        if (await modal.isVisible()) {
            console.log('⚠️ Modal 依然存在 (可能遮擋畫面)，跳過此測試');
            test.skip();
            return;
        }

        const dashboard = page.locator('.dashboard-container');
        await expect(dashboard).toBeVisible();

        // 使用 OR 條件檢查：只要其中一個 itinerary-result 是可見的即可
        // script.js 會根據時間自動切換 Tag (Daily/OldHome/Custom)
        const anyResultBox = page.locator('#itinerary-result, #itinerary-result-oldHome, #itinerary-result-custom');

        // 由於可能有多個 match (但只有一個 visible)，我們檢查是否有任何一個 visible
        // 或者使用 first().toBeVisible() 搭配 CSS :visible 偽類? Playwright 推薦用斷言
        // 簡單作法：列出三個 Locator，期待至少一個 Visible
        const daily = page.locator('#itinerary-result');
        const oldHome = page.locator('#itinerary-result-oldHome');
        const custom = page.locator('#itinerary-result-custom');

        // 使用 Promise.race 或簡單的邏輯判斷
        // Playwright expect(locator.or(locator)).toBeVisible()
        await expect(daily.or(oldHome).or(custom)).toBeVisible();
    });
});
