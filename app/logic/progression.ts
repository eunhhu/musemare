import type { LevelCode } from '../data/levelManifest'

export type EndingAccess = 'locked' | 'completed' | 'prerequisites-unavailable'
export type BattleProgressTarget = [stageIndex:number, levelIndex:number]

export const progressStorageKey = 'clearLevelList'

export function createDefaultProgress(stages:LevelCode[][]) {
    return stages.map(stage => Array.from({ length:Math.max(3, stage.length) }, () => -1))
}

export function parseProgress(serialized:string | null, stages:LevelCode[][]) {
    const fallback = createDefaultProgress(stages)
    if (serialized === null) return { value:fallback, repaired:true }

    let parsed:unknown
    try {
        parsed = JSON.parse(serialized) as unknown
    } catch {
        return { value:fallback, repaired:true }
    }
    if (!Array.isArray(parsed)) return { value:fallback, repaired:true }

    let repaired = parsed.length !== fallback.length
    const value = fallback.map((stage, stageIndex) => {
        const candidate = parsed[stageIndex]
        if (!Array.isArray(candidate)) {
            repaired = true
            return stage
        }
        if (candidate.length !== stage.length) repaired = true
        return stage.map((defaultValue, levelIndex) => {
            const score = candidate[levelIndex]
            if (typeof score === 'number' && Number.isFinite(score) && score >= -1 && score <= 1) return score
            repaired = true
            return defaultValue
        })
    })
    return { value, repaired }
}

export function markLevelCleared(
    progress:number[][],
    stages:LevelCode[][],
    target:BattleProgressTarget,
) {
    const [stageIndex, levelIndex] = target
    if (!stages[stageIndex]?.[levelIndex]) return progress
    return createDefaultProgress(stages).map((stage, currentStageIndex) => stage.map((_score, currentLevelIndex) => {
        const previous = progress[currentStageIndex]?.[currentLevelIndex] ?? -1
        return currentStageIndex === stageIndex && currentLevelIndex === levelIndex
            ? Math.max(previous, 1)
            : previous
    }))
}

function isStageComplete(stages:LevelCode[][], progress:number[][], stageIndex:number) {
    const finalLevelIndex = (stages[stageIndex]?.length ?? 0) - 1
    return finalLevelIndex >= 0 && (progress[stageIndex]?.[finalLevelIndex] ?? -1) >= 0.9
}

function stageHasPlayableBattle(
    stages:LevelCode[][],
    stageIndex:number,
    isAvailable:(code:LevelCode) => boolean,
) {
    return stages[stageIndex]?.some(isAvailable) ?? false
}

function isStageRequirementSatisfied(
    stages:LevelCode[][],
    progress:number[][],
    stageIndex:number,
    isAvailable:(code:LevelCode) => boolean,
) {
    return !stageHasPlayableBattle(stages, stageIndex, isAvailable) || isStageComplete(stages, progress, stageIndex)
}

export function isProgressionStageAccessible(
    stages:LevelCode[][],
    progress:number[][],
    stageIndex:number,
    isAvailable:(code:LevelCode) => boolean,
) {
    return stages.slice(0, stageIndex).every((_stage, index) => (
        isStageRequirementSatisfied(stages, progress, index, isAvailable)
    ))
}

export function getEndingAccess(
    stages:LevelCode[][],
    progress:number[][],
    isAvailable:(code:LevelCode) => boolean,
):EndingAccess {
    const requirementsSatisfied = stages.every((_stage, index) => (
        isStageRequirementSatisfied(stages, progress, index, isAvailable)
    ))
    if (!requirementsSatisfied) return 'locked'

    return stages.some((_stage, index) => !stageHasPlayableBattle(stages, index, isAvailable))
        ? 'prerequisites-unavailable'
        : 'completed'
}
