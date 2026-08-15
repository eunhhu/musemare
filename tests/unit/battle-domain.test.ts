import { describe, expect, it } from 'vitest'
import { levels } from '../../app/data/level'
import type { obj } from '../../app/data/types'
import {
    MAX_PENDING_HITS,
    enqueuePendingHit,
    evaluateJudgements,
    getJudgementWindows,
    isAudioActivelyPlaying,
    prepareNotes,
    timelineStampFromAudio,
} from '../../app/logic/battleDomain'

function chart(stamps: number[], bpm = 120): obj {
    return {
        type: 'chart',
        bpm,
        notes: stamps.map(stamp => ({ stamp, hit: 0, judge: 'none' })),
        position: [50, 50],
        rotate: 0,
        scale: [1, 1],
        opacity: 1,
        anchor: [0, 0],
        events: [],
        visible: true,
    }
}

describe('battle judgement domain', () => {
    it('prepares one stable sorted note index without mutating chart order', () => {
        const objects = [chart([2, 1]), chart([1.5], 200)]
        const prepared = prepareNotes(objects)

        expect(prepared.map(note => note.stamp)).toEqual([1, 1.5, 2])
        expect(prepared.map(note => note.id)).toEqual(['0:1', '1:0', '0:0'])
        expect(objects[0].notes?.map(note => note.stamp)).toEqual([2, 1])
    })

    it('resolves Moai judgement tempo at each note timestamp', () => {
        const prepared = prepareNotes([levels.moai.objs[3]])
        const beforeChange = prepared.find(note => note.stamp === 25.8)
        const afterChange = prepared.find(note => note.stamp === 26.4)

        expect(beforeChange?.beatDuration).toBeCloseTo(60 / 200, 9)
        expect(afterChange?.beatDuration).toBeCloseTo(60 / 400, 9)
    })

    it('resolves sequential Dogbite BPM events with renderer semantics', () => {
        const prepared = prepareNotes([levels.dogbite.objs[1]])
        const firstChange = prepared.find(note => note.stamp === 50.581538)
        const secondChange = prepared.find(note => note.stamp === 61.043076)

        expect(firstChange?.beatDuration).toBeCloseTo(60 / 500, 9)
        expect(secondChange?.beatDuration).toBeCloseTo(60 / 195, 9)
    })

    it('preserves the original tempo-scaled judgement windows', () => {
        expect(getJudgementWindows(0.5)).toEqual({
            perfect: 0.09,
            great: 0.18,
            good: 0.27,
            bad: 0.45,
        })
    })

    it.each([
        [0.08, 'perfect'],
        [0.15, 'great'],
        [0.25, 'good'],
        [0.4, 'bad'],
    ] as const)('classifies a %s second delta as %s', (delta, judgement) => {
        const result = evaluateJudgements(prepareNotes([chart([10])]), [10 + delta], 10 + delta, {})

        expect(result.judgements['0:0'].judge).toBe(judgement)
    })

    it('consumes a hit once and chooses the nearest eligible note', () => {
        const prepared = prepareNotes([chart([1, 1.2])])
        const result = evaluateJudgements(prepared, [1.16], 1.16, {})

        expect(result.judgements).toEqual({
            '0:1': { judge: 'perfect', hit: 1.16 },
        })
        expect(result.pendingHits).toEqual([])
    })

    it('uses simultaneous keys to resolve simultaneous notes on separate lines', () => {
        const prepared = prepareNotes([chart([1]), chart([1])])
        const result = evaluateJudgements(prepared, [1, 1], 1, {})

        expect(result.judgements).toEqual({
            '0:0': { judge:'perfect', hit:1 },
            '1:0': { judge:'perfect', hit:1 },
        })
        expect(result.pendingHits).toEqual([])
    })

    it('marks overdue notes missed and prunes stale unmatched hits', () => {
        const prepared = prepareNotes([chart([1])])
        const result = evaluateJudgements(prepared, [0], 1.5, {})

        expect(result.judgements['0:0'].judge).toBe('miss')
        expect(result.pendingHits).toEqual([])
    })

    it('preserves judgement identity when a frame makes no changes', () => {
        const prepared = prepareNotes([chart([1])])
        const previous = {}
        const result = evaluateJudgements(prepared, [], 0, previous)

        expect(result.judgements).toBe(previous)
    })

    it('caps stalled pending-hit queues', () => {
        const stalledHits = Array.from({ length:MAX_PENDING_HITS * 4 }, () => 10)
        const result = evaluateJudgements([], stalledHits, 10, {})

        expect(result.pendingHits).toHaveLength(MAX_PENDING_HITS)
    })

    it('accepts hits only from active audio and stamps the offset timeline', () => {
        expect(isAudioActivelyPlaying({ paused:false, ended:false, readyState:3 })).toBe(true)
        expect(isAudioActivelyPlaying({ paused:true, ended:false, readyState:4 })).toBe(false)
        expect(isAudioActivelyPlaying({ paused:false, ended:true, readyState:4 })).toBe(false)
        expect(isAudioActivelyPlaying({ paused:false, ended:false, readyState:1 })).toBe(false)
        expect(timelineStampFromAudio({ currentTime:12.5 }, 1.25)).toBe(11.25)
    })

    it('prunes and caps queued input before evaluation', () => {
        const oldHits = Array.from({ length:MAX_PENDING_HITS }, (_, index) => index / 10)
        const next = enqueuePendingHit(oldHits, 20, 20)

        expect(next).toHaveLength(1)
        expect(next[0]).toBe(20)
    })
})
