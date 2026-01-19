// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30 * 1000,
    expect: {
        timeout: 5000
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        // Note: If testing local index.html directly via file:// in Docker, 
        // it might be tricky. It's better to start a local server or use file path relative to container.
        // For simplicity, we assume we might want to check the file directly or a local server.
        // Let's configure it to open files via absolute path in container if needed, 
        // OR recommend user to run a server.
        // For this setup, we will try to use `file://` scheme mapping to /app/index.html
        baseURL: 'file:///app',

        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    // webServer: {
    //   command: 'npm run start',
    //   url: 'http://127.0.0.1:3000',
    //   reuseExistingServer: !process.env.CI,
    // },
});
