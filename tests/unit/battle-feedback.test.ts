import { describe, expect, it } from 'vitest'
import {
    getJudgementFeedbackFrame,
    getRecentJudgementsForObject,
    judgementFeedbackDuration,
    judgementFeedbackVisuals,
} from '../../app/logic/battleFeedback'
import type { JudgementState } from '../../app/logic/battleDomain'

describe('battle judgement feedback', () => {
    it('assigns readable, distinct visuals to every judgement', () => {
        expect(Object.keys(judgementFeedbackVisuals)).toEqual([
            'perfect',
            'great',
            'good',
            'bad',
            'miss',
        ])
        expect(new Set(Object.values(judgementFeedbackVisuals).map(visual => visual.color)).size).toBe(5)
        expect(judgementFeedbackVisuals.perfect.label).toBe('PERFECT')
        expect(judgementFeedbackVisuals.miss.label).toBe('MISS')
    })

    it('animates a pop, lift, burst, and fade for the full feedback lifetime', () => {
        const record = { judge:'perfect' as const, hit:1 }
        const first = getJudgementFeedbackFrame(record, 1)
        const popped = getJudgementFeedbackFrame(record, 1.08)
        const fading = getJudgementFeedbackFrame(record, 1.5)

        expect(first?.progress).toBe(0)
        expect(first?.textScale).toBeCloseTo(0.72, 9)
        expect(first?.textY).toBe(-50)
        expect(first?.ringRadius).toBe(10)
        expect(popped?.textScale).toBeGreaterThan(1)
        expect(popped?.textY).toBeLessThan(-50)
        expect(popped?.ringRadius).toBeGreaterThan(10)
        expect(fading?.textAlpha).toBeLessThan(popped?.textAlpha ?? 0)
        expect(fading?.impactAlpha).toBeLessThan(popped?.impactAlpha ?? 0)
        expect(getJudgementFeedbackFrame(record, 1 + judgementFeedbackDuration)).toBeUndefined()
    })

    it('keeps every recent rapid judgement on its own chart and ignores editor baselines', () => {
        const judgements:JudgementState = {
            '0:0':{ judge:'perfect', hit:1 },
            '0:1':{ judge:'great', hit:1.1 },
            '0:2':{ judge:'miss', hit:Number.NEGATIVE_INFINITY },
            '1:0':{ judge:'bad', hit:1.05 },
        }

        expect(getRecentJudgementsForObject(0, judgements, 1.2).map(item => item.noteId)).toEqual([
            '0:0',
            '0:1',
        ])
        expect(getRecentJudgementsForObject(1, judgements, 1.2).map(item => item.noteId)).toEqual([
            '1:0',
        ])
        expect(getRecentJudgementsForObject(0, judgements, 2)).toEqual([])
    })
})
