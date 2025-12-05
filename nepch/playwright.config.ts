import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2etest',
    outputDir: 'e2etest/test-results/artifacts',
    reporter: [
        ['list'],
        ['html', { outputFolder: 'e2etest/test-results/playwright-report' }]
    ],
    use: {
        trace: 'on-first-retry',
    },
});
