import { describe, expect, it } from 'vitest'
import type { LevelCode } from '../../app/data/levelManifest'
import { getEndingAccess, isProgressionStageAccessible } from '../../app/logic/progression'

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
})
