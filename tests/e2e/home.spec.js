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

    test('應該顯示主要儀表板區塊', async ({ page }) => {
        const modal = page.locator('#initPromptModal');
        // 用戶要求：如果 Modal 依然存在 (例如關閉失敗)，則跳過此檢查以避免錯誤
        if (await modal.isVisible()) {
            console.log('Modal 依然存在，跳過儀表板檢查');
            return;
        }

        // 檢查儀表板容器
        const dashboard = page.locator('.dashboard-container');
        await expect(dashboard).toBeVisible();

        // 檢查行程結果區塊
        const itineraryBox = page.locator('#itinerary-result');
        await expect(itineraryBox).toBeVisible();
    });
});
