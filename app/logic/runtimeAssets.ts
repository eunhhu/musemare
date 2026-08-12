export type RuntimeAssetFailure = {
    kind:'asset'
    phase:'decode'
    source:string
    message:string
}

export function createRuntimeAssetFailure(source:string, cause:unknown):RuntimeAssetFailure {
    return {
        kind:'asset',
        phase:'decode',
        source,
        message:cause instanceof Error ? cause.message : String(cause),
    }
}

export function mediaSourceMatches(currentSource:string, expectedSource:string, baseUrl:string) {
    if (!currentSource || !expectedSource) return false
    try {
        return currentSource === new URL(expectedSource, baseUrl).href
    } catch {
        return false
    }
}
