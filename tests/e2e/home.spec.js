// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Home Page', () => {

    test.beforeEach(async ({ page }) => {
        // Open the index.html file directly from the container's mounted volume
        await page.goto('file:///app/index.html');
    });

    test('should have correct title', async ({ page }) => {
        await expect(page).toHaveTitle(/Odise Gemini Assistant/);
    });

    test('should display main sections', async ({ page }) => {
        // Check for the "Daily Commute" header or similar unique element
        // Note: The UI might have dynamic text based on time, but "每日通勤" or similar usually exists in DOM?
        // Let's check for the main container or specific ID
        const dashboard = page.locator('.dashboard');
        await expect(dashboard).toBeVisible();

        const commuteSection = page.locator('#commute-result');
        await expect(commuteSection).toBeVisible();
    });
});
