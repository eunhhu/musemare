import type { env } from '../data/types'
import { normalizeLanguage } from '../data/lang'

export type PersistedEnv = env & {
    language:string
    volume:number
}

export type PersistedEnvParseResult = {
    value:PersistedEnv
    repaired:boolean
}

const requiredKeys:(keyof env['keys'])[] = [
    'playerLeft',
    'playerRight',
    'playerJump',
    'playerRun',
    'playerSneak',
    'interaction',
    'escape',
]

function isRecord(value:unknown):value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCompatibleLanguage(value:unknown):value is string {
    return typeof value === 'string' && /^(?:en|ko)(?:-[A-Za-z0-9]+)?$/i.test(value)
}

export function isPersistedEnv(value:unknown):value is PersistedEnv {
    if (!isRecord(value)) return false
    const keys = value.keys
    if (!isRecord(keys) || !requiredKeys.every(key => typeof keys[key] === 'string')) return false
    if (!isCompatibleLanguage(value.language)) return false
    return typeof value.volume === 'number'
        && Number.isFinite(value.volume)
        && value.volume >= 0
        && value.volume <= 1
}

export function parsePersistedEnv(serialized:string | null, fallback:PersistedEnv):PersistedEnvParseResult {
    if (serialized === null) return { value:fallback, repaired:true }
    let parsed:unknown
    try {
        parsed = JSON.parse(serialized)
    } catch {
        return { value:fallback, repaired:true }
    }
    if (isPersistedEnv(parsed)) return { value:parsed, repaired:false }
    return { value:fallback, repaired:true }
}

export function envForBrowserLanguage(fallback:PersistedEnv, browserLanguage:string | null | undefined):PersistedEnv {
    return { ...fallback, language:normalizeLanguage(browserLanguage) }
}
