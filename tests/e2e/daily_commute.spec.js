// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Daily Commute Logic', () => {

    test.beforeEach(async ({ page }) => {
        // [Mock] Pre-populate localStorage
        await page.addInitScript(() => {
            const dummyStations = JSON.stringify([{ name: 'Test Station', lat: 25.0, lng: 121.0 }]);
            window.localStorage.setItem('user_stations_train', dummyStations);
            window.localStorage.setItem('user_stations_mrt', dummyStations);
            window.localStorage.setItem('user_stations_bus', dummyStations);
            window.localStorage.setItem('user_stations_bike', dummyStations);
        });

        await page.goto('/');

        // Handle Init Prompt Modal if it appears
        const welcomeModal = page.locator('#initPromptModal');
        try {
            await welcomeModal.waitFor({ state: 'visible', timeout: 3000 });
            await page.locator('#initPromptModal .btn-secondary').click();
            await expect(welcomeModal).toBeHidden({ timeout: 5000 });
        } catch (e) {
            // Modal might not appear if params are already set in localStorage or timing issue
        }

        // Switch to Daily Tab explicitly
        const tabBtn = page.locator('.dashboard-tab-btn', { hasText: '日常通勤' });
        await tabBtn.click();
        await expect(tabBtn).toHaveClass(/active/);
    });

    test('"日常通勤" 分頁應包含 "最佳轉乘方案" 區塊', async ({ page }) => {
        await expect(page.locator('#tab-daily h2', { hasText: '最佳轉乘方案' })).toBeVisible();
    });

    test('"根據設定取得 GPS 並查詢" 按鈕預設應為禁用狀態 (disabled)', async ({ page }) => {
        await expect(page.locator('#sendBtn')).toBeDisabled();
    });

    test('"火車", "捷運", "公車", "YouBike" 列表區塊應正確顯示', async ({ page }) => {
        await expect(page.locator('#tab-daily #train-list')).toBeVisible();
        await expect(page.locator('#tab-daily #mrt-list')).toBeVisible();
        await expect(page.locator('#tab-daily #bus-list')).toBeVisible();
        await expect(page.locator('#tab-daily #bike-list')).toBeVisible();
    });
});
