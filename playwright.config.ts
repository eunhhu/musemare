import { defineConfig } from '@playwright/test'

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    timeout: 30_000,
    expect: {
        timeout: 15_000,
    },
    use: {
        baseURL: 'http://127.0.0.1:3100',
        headless: true,
        launchOptions: executablePath ? { executablePath } : undefined,
        viewport: { width: 1440, height: 900 },
    },
    webServer: {
        command: 'bun run preview',
        env: { PORT: '3100' },
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: false,
        timeout: 120_000,
    },
})
