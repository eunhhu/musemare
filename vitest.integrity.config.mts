import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['tests/integrity/**/*.{test,spec}.{ts,tsx}'],
        allowOnly: !process.env.CI,
    },
})
