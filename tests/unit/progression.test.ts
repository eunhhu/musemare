import { describe, expect, it } from 'vitest'
import type { LevelCode } from '../../app/data/levelManifest'
import {
    getEndingAccess,
    isProgressionStageAccessible,
    markLevelCleared,
    parseProgress,
} from '../../app/logic/progression'

const stages:LevelCode[][] = [['test'], ['moai'], ['dogbite'], ['test']]
const freshProgress = [[-1, -1, -1], [-1, -1, -1], [-1, -1, -1], [-1, -1, -1]]

describe('availability-aware progression', () => {
    it('allows navigation past stages that contain no playable battles', () => {
        const unavailable = () => false

        expect(isProgressionStageAccessible(stages, freshProgress, 0, unavailable)).toBe(true)
        expect(isProgressionStageAccessible(stages, freshProgress, 3, unavailable)).toBe(true)
    })

    it('exposes the ending without inventing completion when every prerequisite is unavailable', () => {
        expect(getEndingAccess(stages, freshProgress, () => false)).toBe('prerequisites-unavailable')
        expect(freshProgress.flat()).toEqual(Array.from({ length:12 }, () => -1))
    })

    it('keeps later content locked behind an available unfinished stage', () => {
        const isAvailable = (code:LevelCode) => code === 'test'

        expect(isProgressionStageAccessible(stages, freshProgress, 1, isAvailable)).toBe(false)
        expect(getEndingAccess(stages, freshProgress, isAvailable)).toBe('locked')
    })

    it('repairs malformed saved progress to a stable shape', () => {
        const parsed = parseProgress('[[null,2],"bad"]', stages)
        expect(parsed.repaired).toBe(true)
        expect(parsed.value).toEqual(freshProgress)
    })

    it('records a clear without mutating prior progress', () => {
        const next = markLevelCleared(freshProgress, stages, [2, 0])
        expect(next[2][0]).toBe(1)
        expect(freshProgress[2][0]).toBe(-1)
    })

    it('uses the final configured level instead of a hard-coded third slot', () => {
        const completed = markLevelCleared(freshProgress, stages, [0, 0])
        const isAvailable = (code:LevelCode) => code === 'test'
        expect(isProgressionStageAccessible(stages, completed, 1, isAvailable)).toBe(true)
    })
})
