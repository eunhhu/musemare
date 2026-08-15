import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    engines?:{ bun?:string, node?:string }
    packageManager?:string
    dependencies:Record<string, string>
    devDependencies:Record<string, string>
    scripts:Record<string, string>
}
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const playwrightConfig = readFileSync('playwright.config.ts', 'utf8')
const vitestConfig = readFileSync('vitest.config.mts', 'utf8')
const ignore = readFileSync('.gitignore', 'utf8')
const viteConfig = readFileSync('vite.config.mts', 'utf8')
const indexHtml = readFileSync('index.html', 'utf8')
const bunConfig = readFileSync('bunfig.toml', 'utf8')
const mapEditor = readFileSync('app/mapeditor/MapEditorClient.tsx', 'utf8')

describe('toolchain integrity', () => {
    it('pins the supported Bun and Node toolchain', () => {
        expect(packageJson.engines?.bun).toBe('>=1.3.14 <2')
        expect(packageJson.engines?.node).toBe('>=24.18 <25')
        expect(packageJson.packageManager).toBe('bun@1.3.14')
        expect(workflow).toContain('node-version: 24.18.1')
        expect(workflow).toContain('oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6')
        expect(workflow).toContain('bun-version: 1.3.14')
        expect(workflow).toContain('test "$(node --version)" = "v24.18.1"')
        expect(workflow).toContain('test "$(bun --version)" = "1.3.14"')
        expect(bunConfig).toContain('auto = "disable"')
    })

    it('uses the committed Bun text lockfile as the only package-manager lock', () => {
        expect(existsSync('bun.lock')).toBe(true)
        expect(existsSync('package-lock.json')).toBe(false)
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
        expect(workflow).toContain('oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6')
    })

    it('runs every required CI gate in order', () => {
        const gates = [
            'bun ci',
            'bun install --frozen-lockfile --dry-run --offline',
            'bun pm ls --all',
            'bun run typecheck',
            'bun run lint',
            'bun run test:unit',
            'bun run test:integrity',
            'bun run audit',
            'bun run build',
            'bun run smoke',
        ]
        let previous = -1
        for (const gate of gates) {
            const index = workflow.indexOf(gate)
            expect(index, gate).toBeGreaterThan(previous)
            previous = index
        }
    })

    it('uses a Vite SPA entry and contains no Next.js runtime contract', () => {
        expect(packageJson.dependencies.next).toBeUndefined()
        expect(packageJson.devDependencies['eslint-config-next']).toBeUndefined()
        expect(packageJson.devDependencies.vite).toBe('8.2.1')
        expect(packageJson.devDependencies['@vitejs/plugin-react']).toBe('6.0.5')
        expect(packageJson.scripts.dev).toBe('bun --bun vite')
        expect(packageJson.scripts.build).toBe('bun --bun vite build')
        expect(viteConfig).toContain("appType:'spa'")
        expect(viteConfig).toContain('plugins:[react()]')
        expect(indexHtml).toContain('<script type="module" src="/app/entry.tsx"></script>')
        for (const nextPath of [
            'next.config.mjs',
            'next-env.d.ts',
            'app/layout.tsx',
            'app/page.tsx',
            'app/editor/page.tsx',
            'app/mapeditor/page.tsx',
            'scripts/start-standalone.mjs',
        ]) expect(existsSync(nextPath), nextPath).toBe(false)
    })

    it('uses the loopback Vite preview and immutable Playwright Noble browser container', () => {
        expect(playwrightConfig).toContain("command: 'bun run preview'")
        expect(playwrightConfig).not.toContain('/usr/bin/chromium')
        expect(playwrightConfig).toContain('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH')
        expect(viteConfig).toContain("host:'127.0.0.1'")
        expect(viteConfig).toContain('port:3100')
        expect(viteConfig).toContain('strictPort:true')
        expect(playwrightConfig).toContain("baseURL: 'http://127.0.0.1:3100'")
        expect(playwrightConfig).toContain("url: 'http://127.0.0.1:3100'")
        expect(workflow).toContain('mcr.microsoft.com/playwright:v1.62.1-noble@sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac')
        expect(workflow).toContain('options: --ipc=host')
        expect(workflow).not.toContain('playwright install')
    })

    it('keeps game state and Pixi renderers behind explicit module boundaries', () => {
        expect(existsSync('app/config/gameConfig.ts')).toBe(true)
        expect(existsSync('app/components/GameSession.tsx')).toBe(true)
        expect(existsSync('app/logic/gameSession.ts')).toBe(true)
        expect(existsSync('app/renderers/BattleRenderer.tsx')).toBe(true)
        expect(existsSync('app/renderers/ExploreRenderer.tsx')).toBe(true)
        expect(existsSync('app/logic/battleEngine.tsx')).toBe(false)
        expect(existsSync('app/logic/exploreEngine.tsx')).toBe(false)
        expect(mapEditor).not.toMatch(/from ['"]\.\.\/main['"]/)
    })

    it('keeps asset-manifest regeneration explicit and out of automatic tests', () => {
        expect(existsSync('scripts/regenerate-asset-manifest.mjs')).toBe(true)
        expect(packageJson.scripts['assets:manifest']).toBe('bun scripts/regenerate-asset-manifest.mjs')
        expect(packageJson.scripts['test:integrity']).not.toContain('assets:manifest')
        expect(packageJson.scripts.test).not.toContain('assets:manifest')
    })

    it('ignores generated reports, maps, CSS, and every local environment file', () => {
        for (const pattern of [
            '/test-results/',
            '/playwright-report/',
            '/dist/',
            '.env*',
            '!.env.example',
            'app/styles/*.css',
            'app/styles/*.css.map',
        ]) expect(ignore).toContain(pattern)

        const trackedResults = execFileSync('git', ['ls-files', 'test-results'], { encoding:'utf8' }).trim()
        expect(trackedResults).toBe('')
    })
})
