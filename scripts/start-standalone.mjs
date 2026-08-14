import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

process.env.HOSTNAME = '127.0.0.1'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')
const server = join(standalone, 'server.js')

if (!existsSync(server)) {
    throw new Error('Standalone build is missing. Run `npm run build` before `npm run smoke`.')
}

const standaloneNext = join(standalone, '.next')
mkdirSync(standaloneNext, { recursive:true })
cpSync(join(root, '.next', 'static'), join(standaloneNext, 'static'), { recursive:true, force:true })
cpSync(join(root, 'public'), join(standalone, 'public'), { recursive:true, force:true })

process.chdir(standalone)
await import(pathToFileURL(server).href)
