import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assetsRoot = join(repositoryRoot, 'public', 'assets')
const manifestPath = join(repositoryRoot, 'assets.sha256')

function assetFiles(directory) {
    return readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return assetFiles(path)
        if (!entry.isFile()) throw new Error(`Asset manifest only supports regular files: ${path}`)
        return [path]
    })
}

const lines = assetFiles(assetsRoot)
    .map(path => {
        const stat = lstatSync(path)
        if (!stat.isFile()) throw new Error(`Asset manifest only supports regular files: ${path}`)
        const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
        const repositoryPath = relative(repositoryRoot, path).split(sep).join('/')
        return { repositoryPath, line:`${digest}  ${repositoryPath}` }
    })
    .sort((left, right) => left.repositoryPath < right.repositoryPath ? -1 : left.repositoryPath > right.repositoryPath ? 1 : 0)
    .map(entry => entry.line)

writeFileSync(manifestPath, `${lines.join('\n')}\n`)
console.log(`Wrote ${lines.length} asset digests to ${relative(repositoryRoot, manifestPath)}.`)
