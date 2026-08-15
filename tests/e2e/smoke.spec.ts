import { readdirSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { worldToScreen } from '../../app/logic/mapEditorDomain'

type RuntimeFailures = {
    consoleErrors:string[]
    pageErrors:string[]
    requestFailures:string[]
    responseFailures:string[]
}

declare global {
    interface Window {
        __musemareAssetFailures?:unknown[]
    }
}

function runtimeAssets(directory:string):string[] {
    return readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? runtimeAssets(path) : [path]
    })
}

async function observeRuntimeFailures(page:Page):Promise<RuntimeFailures> {
    const failures:RuntimeFailures = {
        consoleErrors:[],
        pageErrors:[],
        requestFailures:[],
        responseFailures:[],
    }

    await page.addInitScript(() => {
        window.__musemareAssetFailures = []
        window.addEventListener('musemare:asset-failure', event => {
            window.__musemareAssetFailures?.push((event as CustomEvent).detail)
        })
    })
    page.on('console', message => {
        if (message.type() === 'error') failures.consoleErrors.push(message.text())
    })
    page.on('pageerror', error => failures.pageErrors.push(error.stack ?? error.message))
    page.on('requestfailed', request => {
        failures.requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'request failed'}`)
    })
    page.on('response', response => {
        if (response.status() >= 400) failures.responseFailures.push(`${response.status()} ${response.url()}`)
    })

    return failures
}

async function expectRuntimeReady(page:Page, route:string) {
    const runtime = page.locator('#musemare-runtime')
    await expect(runtime).toHaveAttribute('data-runtime-route', route)
    await expect(runtime).toHaveAttribute('data-app-state', 'ready')
}

async function expectHealthy(page:Page, failures:RuntimeFailures) {
    expect(failures.consoleErrors).toEqual([])
    expect(failures.pageErrors).toEqual([])
    expect(failures.requestFailures).toEqual([])
    expect(failures.responseFailures).toEqual([])
    expect(await page.evaluate(() => window.__musemareAssetFailures ?? [])).toEqual([])
    await expect(page.locator('#musemare-runtime')).not.toHaveAttribute('data-app-state', 'failed')
}

async function expectBackingDimensions(canvas:Locator) {
    await expect.poll(async () => canvas.evaluate(element => {
        const target = element as HTMLCanvasElement
        const rect = target.getBoundingClientRect()
        const expectedWidth = Math.round(rect.width * window.devicePixelRatio)
        const expectedHeight = Math.round(rect.height * window.devicePixelRatio)
        return target.width > 0
            && target.height > 0
            && target.width === expectedWidth
            && target.height === expectedHeight
    })).toBe(true)
}

for (const route of [
    { path:'/', runtime:'main-menu', labels:['New Game', 'Continue', 'Settings', 'Credits'], canvas:false },
    { path:'/editor', runtime:'battle-editor', labels:['New', 'Open', 'Export', 'Play'], canvas:true },
    { path:'/mapeditor', runtime:'map-editor', labels:['Open Map', 'Save Map', 'Create Sprite'], canvas:true },
] as const) {
    test(`${route.path} reaches explicit readiness without runtime failures`, async ({ page }) => {
        const failures = await observeRuntimeFailures(page)
        const response = await page.goto(route.path, { waitUntil:'domcontentloaded' })

        expect(response?.ok()).toBe(true)
        await expectRuntimeReady(page, route.runtime)
        for (const label of route.labels) await expect(page.getByText(label, { exact:true })).toBeVisible()
        if (route.canvas) await expectBackingDimensions(page.locator('canvas').first())
        await expectHealthy(page, failures)
    })
}

test('malformed persisted environment is repaired before the main menu becomes ready', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.addInitScript(() => localStorage.setItem('env', '{'))
    await page.goto('/', { waitUntil:'domcontentloaded' })

    await expectRuntimeReady(page, 'main-menu')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('env')!))).toEqual({
        keys:{
            playerLeft:'KeyA',
            playerRight:'KeyD',
            playerJump:'Space',
            playerRun:'ShiftLeft',
            playerSneak:'ControlLeft',
            interaction:'KeyF',
            escape:'Escape',
        },
        language:'en-US',
        volume:1,
    })
    await expectHealthy(page, failures)
})

test('unsupported browser locale falls back to English without blank menu labels', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.addInitScript(() => {
        localStorage.clear()
        Object.defineProperty(navigator, 'language', { configurable:true, get:() => 'fr-FR' })
    })
    await page.goto('/', { waitUntil:'domcontentloaded' })

    await expectRuntimeReady(page, 'main-menu')
    await expect(page.getByRole('button', { name:'New Game' })).toBeVisible()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('env')!).language)).toBe('en-US')
    await expectHealthy(page, failures)
})

test('settings persist language, master volume, and key bindings', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'main-menu')

    await page.getByRole('button', { name:'Settings' }).click()
    await expectRuntimeReady(page, 'settings')
    await page.getByLabel('Language').selectOption('ko-KR')
    await page.getByRole('button', { name:'오디오' }).click()
    await page.getByLabel('전체 음량').fill('0.25')
    await page.getByRole('button', { name:'조작키' }).click()
    const moveLeft = page.getByLabel('Move left')
    await moveLeft.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(moveLeft).toHaveValue('ArrowLeft')

    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('env')!))).toMatchObject({
        language:'ko-KR',
        volume:0.25,
        keys:{ playerLeft:'ArrowLeft' },
    })
    await page.getByRole('button', { name:'뒤로가기' }).click()
    await expectRuntimeReady(page, 'main-menu')
    await expect(page.getByRole('button', { name:'새 게임' })).toBeVisible()
    await expectHealthy(page, failures)
})

test('New Game intro fallback stays onscreen and continues to unavailable selector entry', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.goto('/', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'main-menu')
    await page.getByText('New Game', { exact:true }).click()
    await expectRuntimeReady(page, 'intro')

    const continueButton = page.getByRole('button', { name:'Continue' })
    await expect(continueButton).toBeVisible()
    const box = await continueButton.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)

    await continueButton.click()
    await expectRuntimeReady(page, 'selector')
    await page.getByText('Fog Forest', { exact:true }).click()
    const unavailable = page.getByRole('button', { name:'Halv — Romanesque — Unavailable' })
    await expect(unavailable).toBeVisible()
    await expect(unavailable).toHaveAttribute('aria-disabled', 'true')
    await unavailable.click({ force:true })
    await expectRuntimeReady(page, 'selector')
    await expect(page.locator('audio')).toHaveCount(0)
    await expectHealthy(page, failures)
})

test('fresh storage reaches the honestly exposed playable ending through visible UI', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'main-menu')

    await page.getByText('New Game', { exact:true }).click()
    await expectRuntimeReady(page, 'intro')
    await page.getByRole('button', { name:'Continue' }).click()
    await expectRuntimeReady(page, 'selector')

    const ending = page.getByRole('button', { name:'Play Ending — prerequisites unavailable' })
    await expect(ending).toBeVisible()
    await expect(page.getByText('No unavailable prerequisite is marked complete.')).toBeVisible()
    await ending.click()

    await expectRuntimeReady(page, 'battle')
    const audio = page.locator('audio')
    await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).readyState >= HTMLMediaElement.HAVE_FUTURE_DATA)).toBe(true)
    const initialTime = await audio.evaluate(element => (element as HTMLAudioElement).currentTime)
    await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(initialTime + 0.1)
    await expectHealthy(page, failures)
})

test('battle audio applies the persisted master volume', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.addInitScript(() => localStorage.setItem('env', JSON.stringify({
        keys:{
            playerLeft:'KeyA', playerRight:'KeyD', playerJump:'Space', playerRun:'ShiftLeft',
            playerSneak:'ControlLeft', interaction:'KeyF', escape:'Escape',
        },
        language:'en-US',
        volume:0.2,
    })))
    await page.goto('/?scene=Battle&battle=ending', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'battle')
    await expect.poll(() => page.locator('audio').evaluate(element => (element as HTMLAudioElement).volume)).toBeCloseTo(0.2, 3)
    await expectHealthy(page, failures)
})

for (const scene of [
    { query:'/?scene=Battle&battle=ending', runtime:'battle', background:'#000000' },
    { query:'/?scene=Explore&explore=preview', runtime:'explore', background:'#000000' },
] as const) {
    test(`${scene.runtime} canvas tracks viewport backing dimensions`, async ({ page }) => {
        const failures = await observeRuntimeFailures(page)
        await page.goto(scene.query, { waitUntil:'domcontentloaded' })
        await expectRuntimeReady(page, scene.runtime)
        const canvas = page.locator('canvas').first()
        await expectBackingDimensions(canvas)
        await expect(canvas).toHaveAttribute('data-pixi-background', scene.background)

        await page.setViewportSize({ width:1200, height:720 })
        await expectBackingDimensions(canvas)
        await expectHealthy(page, failures)
    })
}

test('battle editor resizes its renderer and applies background changes', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.goto('/editor', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'battle-editor')
    const canvas = page.locator('canvas').first()

    await page.locator('.mainset input[type="color"]').first().fill('#123456')
    await expect(canvas).toHaveAttribute('data-pixi-background', '#123456')
    await page.setViewportSize({ width:1280, height:760 })
    await expectBackingDimensions(canvas)
    await expectHealthy(page, failures)
})

for (const invalidImport of [
    { path:'/editor', runtime:'battle-editor', message:/Level import rejected/ },
    { path:'/mapeditor', runtime:'map-editor', message:/Map import rejected/ },
] as const) {
    test(`${invalidImport.path} rejects incomplete JSON without corrupting live state`, async ({ page }) => {
        const failures = await observeRuntimeFailures(page)
        await page.goto(invalidImport.path, { waitUntil:'domcontentloaded' })
        await expectRuntimeReady(page, invalidImport.runtime)
        await page.locator('input[type="file"]').setInputFiles({
            name:'invalid.json',
            mimeType:'application/json',
            buffer:Buffer.from('{}'),
        })

        await expect(page.locator('.import-error')).toContainText(invalidImport.message)
        await expectRuntimeReady(page, invalidImport.runtime)
        if (invalidImport.path === '/editor') {
            await expect(page.locator('canvas').first()).toHaveAttribute('data-pixi-background', '#000000')
        } else {
            await expect(page.getByLabel('Camera position X')).toHaveValue('0')
        }
        await expectHealthy(page, failures)
    })
}

test('map editor drag transforms stay in world space under a rotated scaled camera', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.setViewportSize({ width:1200, height:800 })
    await page.goto('/mapeditor', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'map-editor')

    const camera = { position:[120, -90] as [number, number], rotation:35, scale:1.6, follow:'' }
    const map = {
        camera,
        backgroundColor:'#000000',
        gravity:0.3,
        ground:300,
        player:{
            position:[0, 0], rotation:0, width:100, height:120, opacity:1, anchor:[0.5, 0.5], hitbox:[1, 1],
            src:'/assets/object/white.png', jumpSrc:'', sneakSrc:'', sneakWalkSrc:[], walkSrc:[], runSrc:[],
            isGround:false, isSneak:false, isRun:false, showHitbox:true, dposition:[0, 0], events:[], tags:['player'],
        },
        sprites:[{
            position:[50, 40], rotation:0, width:80, height:60, opacity:1, anchor:[0.5, 0.5], hitbox:[1, 1],
            src:['/assets/object/white.png'], srcIdx:0, isGravity:false, isCollision:false, isGround:false,
            showHitbox:true, dposition:[0, 0], events:[], tags:['drag-target'],
        }],
        texts:[],
    }
    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name:'Open Map' }).click()
    const chooser = await chooserPromise
    await chooser.setFiles({
        name:'transformed-map.json',
        mimeType:'application/json',
        buffer:Buffer.from(JSON.stringify(map)),
    })
    await expect(page.getByLabel('Camera position X')).toHaveValue('120')
    await page.getByText('drag-target', { exact:true }).click()

    const canvas = page.locator('canvas').first()
    const clientPoint = async (world:[number, number]) => {
        const box = await canvas.boundingBox()
        expect(box).not.toBeNull()
        const stageSize:[number, number] = [box!.width, box!.height]
        const screen = worldToScreen(world, stageSize, camera)
        return { x:box!.x + screen[0], y:box!.y + screen[1] }
    }
    const readPair = async (xLabel:string, yLabel:string) => [
        Number(await page.getByLabel(xLabel).inputValue()),
        Number(await page.getByLabel(yLabel).inputValue()),
    ]

    const start = await clientPoint([50, 40])
    const moved = await clientPoint([130, -10])
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(moved.x, moved.y)
    await page.mouse.up()
    await expect.poll(() => readPair('Sprite position X', 'Sprite position Y')).toEqual([
        expect.closeTo(130, 4),
        expect.closeTo(-10, 4),
    ])

    await page.getByRole('button', { name:'Set Size' }).click()
    await expect(page.getByRole('button', { name:'Sizing...' })).toBeVisible()
    const reverseStart = await clientPoint([200, 160])
    const reverseEnd = await clientPoint([-20, -40])
    await page.mouse.move(reverseStart.x, reverseStart.y)
    await page.mouse.down()
    await expect(page.getByRole('button', { name:'Sizing...' })).toBeVisible()
    await page.mouse.move(reverseEnd.x, reverseEnd.y)
    await expect(page.getByRole('button', { name:'Sizing...' })).toBeVisible()
    await page.mouse.up()
    await expect(page.getByRole('button', { name:'Set Size' })).toBeVisible()
    await expect.poll(() => readPair('Sprite width', 'Sprite height')).toEqual([
        expect.closeTo(220, 4),
        expect.closeTo(200, 4),
    ])
    await expect.poll(() => readPair('Sprite position X', 'Sprite position Y')).toEqual([
        expect.closeTo(90, 4),
        expect.closeTo(60, 4),
    ])

    const dimensionsBeforeClick = await readPair('Sprite width', 'Sprite height')
    await page.getByRole('button', { name:'Set Size' }).click()
    await expect(page.getByRole('button', { name:'Sizing...' })).toBeVisible()
    const noDrag = await clientPoint([0, 0])
    await page.mouse.move(noDrag.x, noDrag.y)
    await page.mouse.down()
    await page.mouse.up()
    await expect.poll(() => readPair('Sprite width', 'Sprite height')).toEqual(dimensionsBeforeClick)

    const positionBeforeCancel = await readPair('Sprite position X', 'Sprite position Y')
    const cancelStart = await clientPoint(positionBeforeCancel as [number, number])
    await page.mouse.move(cancelStart.x, cancelStart.y)
    await page.mouse.down()
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.move(cancelStart.x + 100, cancelStart.y + 100)
    await page.mouse.up()
    await expect.poll(() => readPair('Sprite position X', 'Sprite position Y')).toEqual(positionBeforeCancel)
    await expectHealthy(page, failures)
})

test('editor import pauses old audio and seeks after new source metadata', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.goto('/editor', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'battle-editor')
    const input = page.locator('input[type="file"]')
    const level = (offset:number, endpoint:number) => JSON.stringify({
        bpm:120,
        offset,
        song:'/assets/song/icyxis_true_ending.mp3',
        backgroundColor:'#000000',
        volume:100,
        events:[],
        position:[0, 0],
        rotate:0,
        scale:1,
        objs:[],
        filters:{ blur:0, dot:0, motionBlur:0, bloom:0, godray:0, convolution:0, glitch:0, grayscale:0, noise:0, pixelate:0, rgbsplit:0 },
        endpoint,
    })

    await input.setInputFiles({ name:'old-level.json', mimeType:'application/json', buffer:Buffer.from(level(0, 8)) })
    await page.getByText('Play', { exact:true }).click()
    await expect.poll(() => page.locator('[data-testid="editor-audio"]').evaluate(audio => !(audio as HTMLAudioElement).paused)).toBe(true)
    await expect.poll(() => page.locator('[data-testid="editor-audio"]').evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThan(0)

    await input.setInputFiles({ name:'new-level.json', mimeType:'application/json', buffer:Buffer.from(level(1.5, 4)) })
    const transport = page.locator('[data-testid="editor-audio"]')
    await expect.poll(() => transport.evaluate(audio => (audio as HTMLAudioElement).paused)).toBe(true)
    await expect.poll(() => transport.evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeCloseTo(1.5, 1)
    await page.getByText('End', { exact:true }).click()
    await expect.poll(() => transport.evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeCloseTo(5.5, 1)
    await expectHealthy(page, failures)
})

test('editor runtime recovers after broken sprite and audio sources are replaced', async ({ page }) => {
    await observeRuntimeFailures(page)
    await page.goto('/editor', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'battle-editor')
    const runtime = page.locator('#musemare-runtime')
    const level = (song:string, sprite:string) => JSON.stringify({
        bpm:120,
        offset:0,
        song,
        backgroundColor:'#000000',
        volume:100,
        events:[],
        position:[0, 0],
        rotate:0,
        scale:1,
        objs:[{
            type:'sprite',
            position:[50, 50],
            rotate:0,
            scale:[1, 1],
            opacity:1,
            anchor:[0, 0],
            events:[],
            visible:true,
            src:sprite,
        }],
        filters:{ blur:0, dot:0, motionBlur:0, bloom:0, godray:0, convolution:0, glitch:0, grayscale:0, noise:0, pixelate:0, rgbsplit:0 },
        endpoint:8,
    })
    const importLevel = async (name:string, contents:string) => {
        const chooserPromise = page.waitForEvent('filechooser')
        await page.getByRole('button', { name:'Open' }).click()
        const chooser = await chooserPromise
        await chooser.setFiles({ name, mimeType:'application/json', buffer:Buffer.from(contents) })
    }

    await importLevel('broken-level.json', level('/assets/song/missing-editor-audio.mp3', '/assets/object/missing-editor-sprite.png'))
    await expect(runtime).toHaveAttribute('data-app-state', 'failed')
    await expect(runtime).toHaveAttribute('data-runtime-failure', /missing-editor-(audio|sprite)/)
    await expect(page.locator('.runtime-failure')).toBeVisible()

    await importLevel('valid-level.json', level('/assets/song/icyxis_true_ending.mp3', '/assets/object/white.png'))
    await expectRuntimeReady(page, 'battle-editor')
    await expect(page.locator('.runtime-failure')).toHaveCount(0)
    await expect(runtime).not.toHaveAttribute('data-runtime-failure')
    await expect(runtime).toHaveAttribute('data-runtime-pending', '0')
    await expect.poll(() => page.locator('[data-testid="editor-audio"]').evaluate(element => {
        const audio = element as HTMLAudioElement
        return {
            hasMetadata:audio.readyState >= HTMLMediaElement.HAVE_METADATA,
            currentSource:audio.currentSrc,
            error:audio.error?.message ?? null,
        }
    })).toMatchObject({
        hasMetadata:true,
        currentSource:expect.stringContaining('/assets/song/icyxis_true_ending.mp3'),
        error:null,
    })
    expect((await page.evaluate(() => window.__musemareAssetFailures ?? [])).length).toBeGreaterThan(0)
})

test('Chromium decodes every tracked browser asset', async ({ page }) => {
    const failures = await observeRuntimeFailures(page)
    await page.goto('/', { waitUntil:'domcontentloaded' })
    await expectRuntimeReady(page, 'main-menu')
    const publicDirectory = join(process.cwd(), 'public')
    const assets = runtimeAssets(join(publicDirectory, 'assets')).map(file => (
        `/${relative(publicDirectory, file).split(sep).join('/')}`
    ))

    const decodeFailures = await page.evaluate(async assetUrls => {
        const failures:string[] = []
        const withTimeout = <T,>(promise:Promise<T>, asset:string) => Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`decode timeout: ${asset}`)), 20_000)),
        ])

        for (const asset of assetUrls) {
            try {
                const extension = asset.slice(asset.lastIndexOf('.')).toLowerCase()
                if (['.png', '.jpg', '.jpeg', '.svg'].includes(extension)) {
                    const image = new Image()
                    image.src = asset
                    await withTimeout(image.decode(), asset)
                } else if (['.mp3', '.ogg'].includes(extension)) {
                    const response = await fetch(asset)
                    if (!response.ok) throw new Error(`HTTP ${response.status}`)
                    const audioContext = new AudioContext()
                    try {
                        await withTimeout(audioContext.decodeAudioData(await response.arrayBuffer()), asset)
                    } finally {
                        await audioContext.close()
                    }
                } else if (extension === '.mp4') {
                    const response = await fetch(asset)
                    if (!response.ok) throw new Error(`HTTP ${response.status}`)
                    const objectUrl = URL.createObjectURL(await response.blob())
                    const media = document.createElement('video')
                    try {
                        media.preload = 'auto'
                        media.src = objectUrl
                        media.hidden = true
                        document.body.append(media)
                        await withTimeout(new Promise<void>((resolve, reject) => {
                            media.addEventListener('loadeddata', () => resolve(), { once:true })
                            media.addEventListener('error', () => reject(new Error(media.error?.message ?? 'media decode failed')), { once:true })
                            media.load()
                        }), asset)
                    } finally {
                        media.pause()
                        media.removeAttribute('src')
                        media.load()
                        media.remove()
                        URL.revokeObjectURL(objectUrl)
                    }
                }
            } catch (error) {
                failures.push(`${asset}: ${error instanceof Error ? error.message : String(error)}`)
            }
        }
        return failures
    }, assets)

    expect(decodeFailures).toEqual([])
    expect(assets.some(asset => extname(asset) === '.mp3')).toBe(true)
    await expectHealthy(page, failures)
})
