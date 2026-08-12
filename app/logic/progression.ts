import type { LevelCode } from '../data/levelManifest'

export type EndingAccess = 'locked' | 'completed' | 'prerequisites-unavailable'

function isStageComplete(progress:number[][], stageIndex:number) {
    return (progress[stageIndex]?.[2] ?? -1) >= 0.9
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
    return !stageHasPlayableBattle(stages, stageIndex, isAvailable) || isStageComplete(progress, stageIndex)
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
