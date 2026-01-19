// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Home Page', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to baseURL (http://localhost:3000)
        await page.goto('/');
    });

    test('should have correct title', async ({ page }) => {
        await expect(page).toHaveTitle(/Assistant/);
    });

    test('should display main sections', async ({ page }) => {
        // Check for the main dashboard container
        const dashboard = page.locator('.dashboard-container');
        await expect(dashboard).toBeVisible();

        // Check for the itinerary result area (default active tab)
        const itineraryBox = page.locator('#itinerary-result');
        await expect(itineraryBox).toBeVisible();
    });
});
