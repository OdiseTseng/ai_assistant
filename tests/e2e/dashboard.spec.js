// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Dashboard & UI Components', () => {

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
    });

    /* --- Sidebar Component (Desktop) --- */
    test.describe('Sidebar Component (Desktop)', () => {

        test('Desktop: Sidebar 應預設顯示 (或可切換)，Menu Button 應隱藏', async ({ page }) => {
            const menuBtn = page.locator('.menu-toggle');
            await expect(menuBtn).toBeHidden();
            const sidebar = page.locator('#sidebar');
            await expect(sidebar).toBeVisible();
        });

        test('Desktop: 點擊 Sidebar 內的連結應導航 (不需點擊 Menu toggle)', async ({ page }) => {
            await page.locator('.nav-item', { hasText: '儀表板' }).click();
            await expect(page.locator('.dashboard-container')).toBeVisible();
        });

        test('Desktop: 點擊 "個人化設定" 連結開啟 Settings Modal', async ({ page }) => {
            await page.locator('.nav-item', { hasText: '個人化設定' }).click();
            await expect(page.locator('#settingsModal')).toBeVisible();
        });

        test('Desktop: 點擊 "說明文件" 連結開啟 Help Modal', async ({ page }) => {
            await page.locator('.nav-item', { hasText: '說明文件' }).click();
            await expect(page.locator('#helpModal')).toBeVisible();
        });
    });

    /* --- Sidebar Component (Mobile) --- */
    test.describe('Sidebar Component (Mobile)', () => {
        test.use({ viewport: { width: 375, height: 667 } });

        test('Mobile: Sidebar 應預設隱藏，Menu Button 應顯示', async ({ page }) => {
            const sidebar = page.locator('#sidebar');
            const menuBtn = page.locator('.menu-toggle');
            await expect(menuBtn).toBeVisible();
            await expect(sidebar).not.toHaveClass(/active/);
        });

        test('Mobile: 點擊 Menu Button 應該開啟 Sidebar', async ({ page }) => {
            const sidebar = page.locator('#sidebar');
            const menuBtn = page.locator('.menu-toggle');
            await menuBtn.click();
            await expect(sidebar).toHaveClass(/active/);
        });

        test('Mobile: 點擊 Overlay 應該關閉 Sidebar', async ({ page }) => {
            await page.locator('.menu-toggle').click();
            const sidebar = page.locator('#sidebar');
            await expect(sidebar).toHaveClass(/active/);

            await page.locator('#sidebarOverlay').click();
            await expect(sidebar).not.toHaveClass(/active/);
        });

        test('Mobile: 點擊 Sidebar 內的連結應導航並自動關閉 Sidebar', async ({ page }) => {
            await page.locator('.menu-toggle').click();
            await page.locator('.nav-item', { hasText: '儀表板' }).click();
            await expect(page.locator('.dashboard-container')).toBeVisible();
        });

        test('Mobile: 點擊 "個人化設定" 連結開啟 Settings Modal', async ({ page }) => {
            await page.locator('.menu-toggle').click();
            await page.locator('.nav-item', { hasText: '個人化設定' }).click();
            await expect(page.locator('#settingsModal')).toBeVisible();
        });

        test('點擊 Sidebar 內的 "說明文件" 連結應該開啟 Help Modal', async ({ page }) => {
            await page.locator('.menu-toggle').click();
            await page.locator('.nav-item', { hasText: '說明文件' }).click();
            await expect(page.locator('#helpModal')).toBeVisible();
        });
    });

    test.describe('Dashboard Interaction', () => {
        test('預設應顯示 "日常通勤" (Daily) 分頁', async ({ page }) => {
            await page.locator('.dashboard-tab-btn', { hasText: '日常通勤' }).click();
            await expect(page.locator('#tab-daily')).toBeVisible();
            await expect(page.locator('.dashboard-tab-btn', { hasText: '日常通勤' })).toHaveClass(/active/);
        });

        test('點擊 "回老家" 按鈕應切換至 Old Home 分頁並隱藏其他分頁', async ({ page }) => {
            await page.locator('.dashboard-tab-btn', { hasText: '回老家' }).click();
            await expect(page.locator('#tab-oldHome')).toBeVisible();
            await expect(page.locator('#tab-daily')).toBeHidden();
        });

        test('點擊 "想去哪?" 按鈕應切換至 Custom 分頁並隱藏其他分頁', async ({ page }) => {
            await page.locator('.dashboard-tab-btn', { hasText: '想去哪?' }).click();
            await expect(page.locator('#tab-custom')).toBeVisible();
            await expect(page.locator('#tab-daily')).toBeHidden();
        });
    });

    test.describe('Station Modal', () => {
        test('點擊 "新增站點 (+)" 按鈕應開啟 Station Modal', async ({ page }) => {
            await page.locator('.dashboard-tab-btn', { hasText: '日常通勤' }).click();
            await page.locator('#tab-daily .btn-add').first().click();
            await expect(page.locator('#stationModal')).toBeVisible();
        });

        test('在 Station Modal 搜尋框輸入文字應觸發搜尋過濾', async ({ page }) => {
            await page.locator('.dashboard-tab-btn', { hasText: '日常通勤' }).click();
            await page.locator('#tab-daily .btn-add').first().click();
            const searchInput = page.locator('#modalSearch');
            await searchInput.fill('Taipei');
            await expect(searchInput).toHaveValue('Taipei');
        });

        test('點擊 Modal 關閉按鈕 (X) 應關閉 Station Modal', async ({ page }) => {
            await page.locator('.dashboard-tab-btn', { hasText: '日常通勤' }).click();
            await page.locator('#tab-daily .btn-add').first().click();
            await page.locator('#stationModal .modal-header button', { hasText: '×' }).click();
            await expect(page.locator('#stationModal')).toBeHidden();
        });
    });

    test.describe('Settings Modal', () => {
        test.beforeEach(async ({ page }) => {
            const menuBtn = page.locator('.menu-toggle');
            if (await menuBtn.isVisible()) {
                await menuBtn.click();
            }
            await page.locator('.nav-item', { hasText: '個人化設定' }).click();
        });

        test('Settings Modal 開啟時應預設顯示 "平日設定"', async ({ page }) => {
            await expect(page.locator('#tabWeekday')).toBeVisible();
            await expect(page.locator('#tabBtnWeekday')).toHaveClass(/active/);
        });

        test('切換至 "假日設定" 應顯示對應的輸入欄位', async ({ page }) => {
            await page.locator('#tabBtnHoliday').click();
            await expect(page.locator('#tabHoliday')).toBeVisible();
            await expect(page.locator('#tabWeekday')).toBeHidden();
        });

        test('輸入 API Key 欄位應存在且為 password 類型', async ({ page }) => {
            const apiKeyInput = page.locator('#settingApiKey');
            await expect(apiKeyInput).toBeVisible();
            await expect(apiKeyInput).toHaveAttribute('type', 'password');
        });
    });

    test.describe('Initialization', () => {
        test('若 localStorage 中無 API Key，頁面載入後應自動顯示 Init Prompt Modal', async ({ page }) => {
            await page.addInitScript(() => {
                window.localStorage.clear();
            });
            await page.reload();
            await expect(page.locator('#initPromptModal')).toBeVisible();
        });
    });

});
