import { describe, expect, it } from 'vitest'
import type { event } from '../../app/data/types'
import { evaluateWiggle, wiggleDurationRate, wiggleDurationSeconds } from '../../app/logic/wiggle'

function wiggle(overrides:Partial<event> = {}):event {
    return {
        stamp:2,
        type:'wiggle',
        value:50,
        duration:200,
        speed:8,
        smooth:true,
        axis:'both',
        seed:42,
        octaves:3,
        falloff:0.5,
        ...overrides,
    }
}

describe('wiggle motion', () => {
    it('keeps duration conversion compatible with existing levels', () => {
        expect(wiggleDurationSeconds({ duration:200 })).toBeCloseTo(0.3)
        expect(wiggleDurationRate(0.3)).toBeCloseTo(200)
    })

    it('is deterministic and begins without a transform jump', () => {
        const value = wiggle()
        expect(evaluateWiggle(value, 2)).toEqual({ x:0, y:0, envelope:0 })
        expect(evaluateWiggle(value, 2.12)).toEqual(evaluateWiggle(value, 2.12))
    })

    it('supports independent axes while legacy events stay vertical', () => {
        const legacy = evaluateWiggle(wiggle({ axis:undefined }), 2.12)
        const horizontal = evaluateWiggle(wiggle({ axis:'x' }), 2.12)
        const both = evaluateWiggle(wiggle({ axis:'both' }), 2.12)

        expect(legacy.x).toBe(0)
        expect(legacy.y).not.toBe(0)
        expect(horizontal.x).not.toBe(0)
        expect(horizontal.y).toBe(0)
        expect(both.x).not.toBe(0)
        expect(both.y).not.toBe(0)
    })

    it('smoothly returns toward rest at the end when enabled', () => {
        const smooth = evaluateWiggle(wiggle({ smooth:true }), 2.299)
        const hard = evaluateWiggle(wiggle({ smooth:false }), 2.299)
        expect(smooth.envelope).toBeLessThan(0.001)
        expect(hard.envelope).toBe(1)
        expect(Math.abs(smooth.x) + Math.abs(smooth.y)).toBeLessThan(Math.abs(hard.x) + Math.abs(hard.y))
    })

    it('changes the motion field when seed or complexity changes', () => {
        const baseline = evaluateWiggle(wiggle(), 2.12)
        expect(evaluateWiggle(wiggle({ seed:99 }), 2.12)).not.toEqual(baseline)
        expect(evaluateWiggle(wiggle({ octaves:1 }), 2.12)).not.toEqual(baseline)
    })
})
