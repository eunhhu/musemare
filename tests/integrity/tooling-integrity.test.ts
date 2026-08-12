import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    engines?:{ node?:string }
    packageManager?:string
    scripts:Record<string, string>
}
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const playwrightConfig = readFileSync('playwright.config.ts', 'utf8')
const vitestConfig = readFileSync('vitest.config.mts', 'utf8')
const ignore = readFileSync('.gitignore', 'utf8')
const nextConfig = readFileSync('next.config.mjs', 'utf8')

describe('toolchain integrity', () => {
    it('pins the supported Node and npm toolchain', () => {
        expect(packageJson.engines?.node).toBe('>=22.12 <23')
        expect(packageJson.packageManager).toBe('npm@11.6.2')
        expect(workflow).toContain('node-version: 22.22.0')
        expect(workflow).toContain('npm install --global npm@11.6.2')
        expect(workflow).toContain('test "$(npm --version)" = "11.6.2"')
    })

    it('discovers unit tests without hardcoded filenames and fails on focused tests in CI', () => {
        expect(packageJson.scripts['test:unit']).not.toMatch(/tests\/.+\.(?:test|spec)\.[jt]sx?/)
        expect(packageJson.scripts['test:integrity']).not.toMatch(/tests\/.+\.(?:test|spec)\.[jt]sx?/)
        expect(vitestConfig).toContain('**/*.{test,spec}.{ts,tsx}')
        expect(vitestConfig).toContain('allowOnly: !process.env.CI')
        expect(playwrightConfig).toContain('forbidOnly: Boolean(process.env.CI)')
    })

    it('pins reviewed official actions and disables persisted checkout credentials', () => {
        expect(workflow).toContain('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1')
        expect(workflow).toContain('persist-credentials: false')
        expect(workflow).toContain('git config --global --add safe.directory "$GITHUB_WORKSPACE"')
        expect(workflow).toContain('actions/setup-node@820762786026740c76f36085b0efc47a31fe5020')
    })

    it('runs every required CI gate in order', () => {
        const gates = [
            'npm ci',
            'npm ci --dry-run --offline',
            'npm ls --all',
            'npm run typecheck',
            'npm run lint',
            'npm run test:unit',
            'npm run test:integrity',
            'npm run audit',
            'npm run build',
            'npm run smoke',
        ]
        let previous = -1
        for (const gate of gates) {
            const index = workflow.indexOf(gate)
            expect(index, gate).toBeGreaterThan(previous)
            previous = index
        }
    })

    it('uses a standalone smoke server and the immutable Playwright Noble browser container', () => {
        expect(nextConfig).toContain("output: 'standalone'")
        expect(playwrightConfig).toContain("command: 'npm run start:standalone'")
        expect(playwrightConfig).not.toContain('/usr/bin/chromium')
        expect(playwrightConfig).toContain('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH')
        expect(workflow).toContain('mcr.microsoft.com/playwright:v1.62.1-noble@sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac')
        expect(workflow).toContain('options: --ipc=host')
        expect(workflow).not.toContain('playwright install')
    })

    it('forces the standalone server to loopback before importing it', () => {
        const fixture = mkdtempSync(join(tmpdir(), 'musemare-standalone-'))
        const observation = join(fixture, 'server-observation.json')
        mkdirSync(join(fixture, '.next', 'standalone'), { recursive:true })
        mkdirSync(join(fixture, '.next', 'static'), { recursive:true })
        mkdirSync(join(fixture, 'public'), { recursive:true })
        writeFileSync(join(fixture, '.next', 'standalone', 'server.js'), [
            "const { writeFileSync } = require('node:fs')",
            "writeFileSync(process.env.SERVER_OBSERVATION, JSON.stringify({ hostname:process.env.HOSTNAME }))",
        ].join('\n'))

        try {
            execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'start-standalone.mjs')], {
                cwd:fixture,
                env:{
                    ...process.env,
                    HOSTNAME:'playwright-container-hostname',
                    SERVER_OBSERVATION:observation,
                },
            })
            expect(JSON.parse(readFileSync(observation, 'utf8'))).toEqual({ hostname:'127.0.0.1' })
            expect(playwrightConfig).toContain("baseURL: 'http://127.0.0.1:3100'")
            expect(playwrightConfig).toContain("url: 'http://127.0.0.1:3100'")
        } finally {
            rmSync(fixture, { recursive:true, force:true })
        }
    })

    it('keeps asset-manifest regeneration explicit and out of automatic tests', () => {
        expect(existsSync('scripts/regenerate-asset-manifest.mjs')).toBe(true)
        expect(packageJson.scripts['assets:manifest']).toBe('node scripts/regenerate-asset-manifest.mjs')
        expect(packageJson.scripts['test:integrity']).not.toContain('assets:manifest')
        expect(packageJson.scripts.test).not.toContain('assets:manifest')
    })

    it('ignores generated reports, maps, CSS, and every local environment file', () => {
        for (const pattern of [
            '/test-results/',
            '/playwright-report/',
            '.env*',
            '!.env.example',
            'app/styles/*.css',
            'app/styles/*.css.map',
        ]) expect(ignore).toContain(pattern)

        const trackedResults = execFileSync('git', ['ls-files', 'test-results'], { encoding:'utf8' }).trim()
        expect(trackedResults).toBe('')
    })
})
