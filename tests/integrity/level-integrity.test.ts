import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { levels } from '../../app/data/level'
import { levelManifest } from '../../app/data/levelManifest'

const expectedLevelShape = {
    test: { events:72, objects:7, notes:43 },
    moai: { events:89, objects:11, notes:153 },
    dogbite: { events:113, objects:3, notes:569 },
    ending: { events:1, objects:3, notes:14 },
}

const expectedPayloadHashes = {
    test:'35265be3f25e58bb3bf602204390c74fabd6d638e7dfb93cb7adf07fb6434a08',
    moai:'9220e1564b30c8e488541e0303174cacf0425781c24af6e864b446daf45b3d3d',
    dogbite:'08901078f45de0ba63b689a165a7028cf63e4ddc35b9d81c382002c801f72744',
    ending:'592c8f9a2d3dd99acae570f180a205f719e0a8ccfba6c9b8efdcda6651e8522c',
}

const expectedLevelAssetBindings = {
    test:{ song:'', spriteSources:[], availability:'unavailable', assetPath:null, track:['Halv', 'Romanesque'], provenanceKey:'https://cdn.discordapp.com/attachments/1154783041399574578/1154784269504360460/Halv_-_Romanesque.ogg?ex=65163468&is=6514e2e8&hm=879b834f79d46e559d533f1bee4647e864c2b399f33b9511f9740148356178d5&' },
    moai:{
        song:'', availability:'unavailable', assetPath:null, track:['Exyl', 'MOAI'], provenanceKey:'https://cdn.discordapp.com/attachments/1154783041399574578/1154783833628086383/Exyl_-_MOAI.ogg?ex=651d7440&is=651c22c0&hm=b8a100d0af3f8793e7eb1b55f0dde9cd876e4327cc0ff54a47c46dbdcf478d61&',
        spriteSources:[
            [0, '/assets/object/bg_spotlight.jpg'],
            [5, '/assets/object/bg_space.jpg'],
            [8, '/assets/object/omg.png'],
            [9, '/assets/object/omg.png'],
            [10, '/assets/object/omg.png'],
        ],
    },
    dogbite:{ song:'', spriteSources:[], availability:'unavailable', assetPath:null, track:['t+pazolite', 'Dogbite'], provenanceKey:'https://cdn.discordapp.com/attachments/1154783041399574578/1159310869650485358/tpazolitedogbite.ogg?ex=65308f62&is=651e1a62&hm=617858039222cd2b58ec1b5bbfd8aa1911e73a916c9d4e50d1bb1e07d07bb9e9&' },
    ending:{
        song:'/assets/song/icyxis_true_ending.mp3', availability:'available', assetPath:'/assets/song/icyxis_true_ending.mp3', track:['', 'icyxis_true_ending'], provenanceKey:'public/assets/song/icyxis_true_ending.mp3',
        spriteSources:[
            [0, '/assets/object/bg_computer.jpg'],
            [2, '/assets/object/grad.png'],
        ],
    },
}

function recursiveFiles(directory:string):string[] {
    return readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
        const path = join(directory, entry.name)
        return entry.isDirectory() ? recursiveFiles(path) : [path]
    })
}

function sourceFiles(directory:string) {
    return recursiveFiles(directory).filter(file => /\.(ts|tsx|scss)$/.test(file))
}

function publicAssetExists(asset:string) {
    return existsSync(join(process.cwd(), 'public', asset.replace(/^\//, '')))
}

function normalizePayload(value:unknown):unknown {
    if (Array.isArray(value)) {
        return value.map(normalizePayload)
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .filter(([key]) => key !== 'song' && key !== 'src')
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, normalizePayload(entry)]))
    }
    return value
}

function payloadHash(value:unknown) {
    return createHash('sha256').update(JSON.stringify(normalizePayload(value))).digest('hex')
}

function hasExpectedSignature(file:string) {
    const bytes = readFileSync(file)
    const extension = file.split('.').at(-1)?.toLowerCase()
    if (extension === 'png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    if (extension === 'jpg' || extension === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    if (extension === 'svg') return bytes.toString('utf8', 0, Math.min(bytes.length, 512)).includes('<svg')
    if (extension === 'ogg') return bytes.toString('ascii', 0, 4) === 'OggS'
    if (extension === 'mp4') return bytes.toString('ascii', 4, 8) === 'ftyp'
    if (extension === 'mp3') return bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    return false
}

describe('embedded level integrity', () => {
    it('keeps all four level payload sizes intact', () => {
        expect(Object.keys(levels)).toEqual(Object.keys(expectedLevelShape))

        for (const [name, expected] of Object.entries(expectedLevelShape)) {
            const level = levels[name]
            const notes = level.objs.reduce((total, object) => total + (object.notes?.length ?? 0), 0)

            expect(level.events, `${name} events`).toHaveLength(expected.events)
            expect(level.objs, `${name} objects`).toHaveLength(expected.objects)
            expect(notes, `${name} notes`).toBe(expected.notes)
        }
    })

    it('protects normalized event, object, and note payloads with deterministic hashes', () => {
        for (const [name, level] of Object.entries(levels)) {
            expect(payloadHash(level), name).toBe(expectedPayloadHashes[name as keyof typeof expectedPayloadHashes])
        }
    })

    it('separately binds songs, sprite sources, provenance, and availability', () => {
        const bindings = Object.fromEntries(Object.entries(levels).map(([name, level]) => {
            const manifest = levelManifest[name as keyof typeof levelManifest]
            return [name, {
                song:level.song,
                spriteSources:level.objs.flatMap((object, objectIndex) => object.type === 'sprite'
                    ? [[objectIndex, object.src]]
                    : []
                ),
                availability:manifest.availability,
                assetPath:manifest.assetPath,
                track:[manifest.track.artist, manifest.track.title],
                provenanceKey:'originalUrl' in manifest.provenance
                    ? manifest.provenance.originalUrl
                    : manifest.provenance.repositoryPath,
            }]
        }))

        expect(bindings).toEqual(expectedLevelAssetBindings)
    })

    it('marks unmatched original recordings unavailable without substituting songs', () => {
        for (const name of ['test', 'moai', 'dogbite'] as const) {
            expect(levelManifest[name].availability).toBe('unavailable')
            expect(levels[name].song).toBe('')
            expect(levelManifest[name].track.artist.length).toBeGreaterThan(0)
            expect(levelManifest[name].track.title.length).toBeGreaterThan(0)
            expect(levelManifest[name].provenance.originalUrl).toMatch(/^https:\/\//)
        }

        expect(levelManifest.ending.availability).toBe('available')
        expect(levelManifest.ending.assetPath).toBe(levels.ending.song)
    })

    it('keeps every available level and sprite asset local and present', () => {
        for (const [name, level] of Object.entries(levels)) {
            const manifest = levelManifest[name as keyof typeof levelManifest]
            if (manifest.availability === 'available') {
                expect(level.song, `${name} song must be root-relative`).toMatch(/^\/assets\//)
                expect(publicAssetExists(level.song), `${name} song is missing: ${level.song}`).toBe(true)
            }

            for (const object of level.objs) {
                if (object.type !== 'sprite') continue
                expect(object.src, `${name} sprite must be root-relative`).toMatch(/^\/assets\//)
                expect(publicAssetExists(object.src!), `${name} sprite is missing: ${object.src}`).toBe(true)
            }
        }
    })

    it('stores runtime assets as regular nonempty files with matching signatures', () => {
        const assets = recursiveFiles(join(process.cwd(), 'public', 'assets'))
        expect(assets.length).toBeGreaterThan(0)
        for (const asset of assets) {
            const stat = lstatSync(asset)
            expect(stat.isFile(), asset).toBe(true)
            expect(stat.size, asset).toBeGreaterThan(0)
            expect(hasExpectedSignature(asset), asset).toBe(true)
        }
    })

    it('matches every public asset path and byte digest to the committed SHA-256 manifest', () => {
        const manifestPath = join(process.cwd(), 'assets.sha256')
        expect(existsSync(manifestPath), 'assets.sha256 is missing').toBe(true)
        if (!existsSync(manifestPath)) return

        const entries = readFileSync(manifestPath, 'utf8').trim().split('\n').filter(Boolean).map(line => {
            const match = line.match(/^([a-f0-9]{64})  (public\/assets\/.+)$/)
            expect(match, `invalid asset manifest line: ${line}`).not.toBeNull()
            return { digest:match?.[1] ?? '', path:match?.[2] ?? '' }
        })
        const actualPaths = recursiveFiles(join(process.cwd(), 'public', 'assets'))
            .map(file => relative(process.cwd(), file).split(sep).join('/'))
            .sort()
        const manifestPaths = entries.map(entry => entry.path)

        expect(manifestPaths).toEqual([...manifestPaths].sort())
        expect(new Set(manifestPaths).size).toBe(manifestPaths.length)
        expect(manifestPaths).toEqual(actualPaths)
        for (const entry of entries) {
            const digest = createHash('sha256').update(readFileSync(join(process.cwd(), entry.path))).digest('hex')
            expect(digest, entry.path).toBe(entry.digest)
        }
    })

    it('contains no unexpected external or missing literal asset references', () => {
        const references = sourceFiles(join(process.cwd(), 'app')).flatMap(file => {
            const source = readFileSync(file, 'utf8')
            return Array.from(source.matchAll(/["'`](https?:\/\/[^"'`]+|[^"'`]*assets\/[^"'`]+)["'`]/g))
                .map(match => ({ file, asset:match[1] }))
        })

        const external = references.filter(reference => (
            /^https?:\/\//.test(reference.asset) && !reference.file.endsWith('levelManifest.ts')
        ))
        const nonRootRelative = references.filter(reference => (
            reference.asset.includes('assets/')
            && !reference.asset.startsWith('/assets/')
            && !reference.file.endsWith('levelManifest.ts')
        ))
        const missing = references
            .filter(reference => reference.asset.startsWith('/assets/'))
            .filter(reference => !publicAssetExists(reference.asset))

        expect(external).toEqual([])
        expect(nonRootRelative).toEqual([])
        expect(missing).toEqual([])
    })
})
