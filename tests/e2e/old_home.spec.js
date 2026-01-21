// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Old Home Logic', () => {

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

        // Switch to Old Home Tab explicitly
        const tabBtn = page.locator('.dashboard-tab-btn', { hasText: '回老家' });
        await tabBtn.click();
        await expect(tabBtn).toHaveClass(/active/);
    });

    test('"回老家" 分頁應包含 "回老家規劃" 區塊', async ({ page }) => {
        await expect(page.locator('#tab-oldHome h2', { hasText: '回老家規劃' })).toBeVisible();
    });

    test('"回家囉" 按鈕默認應為禁用狀態 (disabled)', async ({ page }) => {
        await expect(page.locator('#sendBtnOldHome')).toBeDisabled();
    });

    test('Old Home: "火車", "捷運", "公車", "YouBike" 列表區塊應正確顯示', async ({ page }) => {
        await expect(page.locator('#tab-oldHome #train-list-2')).toBeVisible();
        await expect(page.locator('#tab-oldHome #mrt-list-2')).toBeVisible();
        await expect(page.locator('#tab-oldHome #bus-list-2')).toBeVisible();
        await expect(page.locator('#tab-oldHome #bike-list-2')).toBeVisible();
    });
});
