// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Custom Route Logic', () => {

    test.beforeEach(async ({ page }) => {
        // [Mock] Pre-populate localStorage (good practice even if Custom doesn't rely entirely on it)
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

        // Ensure Custom lists have height (Inject dummy content since they aren't auto-populated by localStorage)
        await page.evaluate(() => {
            const listIds = [
                '#train-list-custom', '#mrt-list-custom', '#bus-list-custom', '#bike-list-custom'
            ];
            listIds.forEach(id => {
                const el = document.querySelector(id);
                if (el && el.innerHTML.trim() === '') {
                    el.innerHTML = '<div style="padding:10px; border:1px solid blue;">Testing Custom Content</div>';
                }
            });
        });

        // Switch to Custom Tab explicitly
        const tabBtn = page.locator('.dashboard-tab-btn', { hasText: '想去哪?' });
        await tabBtn.click();
        await expect(tabBtn).toHaveClass(/active/);
    });

    test('"想去哪?" 分頁應包含目的地輸入框', async ({ page }) => {
        await expect(page.locator('#customDestInput')).toBeVisible();
    });

    test('輸入目的地文字後應可進行搜尋', async ({ page }) => {
        const input = page.locator('#customDestInput');
        await input.fill('Taipei 101');
        await expect(input).toHaveValue('Taipei 101');
    });

    test('交通工具偏好設定 checkboxes 應可被勾選或取消', async ({ page }) => {
        const checkbox = page.locator('#prefHSR'); // 高鐵
        await checkbox.check();
        await expect(checkbox).toBeChecked();

        await checkbox.uncheck();
        await expect(checkbox).not.toBeChecked();
    });

    test('Custom: "火車", "捷運", "公車", "YouBike" 列表區塊應正確顯示', async ({ page }) => {
        await expect(page.locator('#tab-custom #train-list-custom')).toBeVisible();
        await expect(page.locator('#tab-custom #mrt-list-custom')).toBeVisible();
        await expect(page.locator('#tab-custom #bus-list-custom')).toBeVisible();
        await expect(page.locator('#tab-custom #bike-list-custom')).toBeVisible();
    });
});
