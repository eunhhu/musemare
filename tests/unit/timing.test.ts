import { describe, expect, it } from 'vitest'
import { audioTimeToTimeline, buildGridLines, clampTimeline } from '../../app/logic/timing'

describe('timeline helpers', () => {
    it('converts audio time using the level offset', () => {
        expect(audioTimeToTimeline(12.5, 1.25)).toBe(11.25)
    })

    it('clamps editor seeks to the level duration', () => {
        expect(clampTimeline(-2, 90)).toBe(0)
        expect(clampTimeline(45, 90)).toBe(45)
        expect(clampTimeline(120, 90)).toBe(90)
    })

    it('builds deterministic grid lines including the endpoint', () => {
        expect(buildGridLines({ bpm: 120, divisions: 2, endpoint: 1, offset: 0 }))
            .toEqual([0, 0.25, 0.5, 0.75, 1])
    })
})
