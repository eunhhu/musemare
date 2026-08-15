import { describe, expect, it } from 'vitest'
import { levels } from '../../app/data/level'
import type { obj } from '../../app/data/types'
import {
    MAX_PENDING_HITS,
    createSkippedJudgementBaseline,
    enqueuePendingHit,
    evaluateJudgements,
    getJudgementWindows,
    isAudioActivelyPlaying,
    prepareNotes,
    resolveObjectBpmAt,
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
        const chartObject = levels.moai.objs[3]

        expect(resolveObjectBpmAt(chartObject, 25.8)).toBeCloseTo(200, 9)
        expect(resolveObjectBpmAt(chartObject, 26.4)).toBeCloseTo(400, 9)
    })

    it('resolves sequential Dogbite BPM events with renderer semantics', () => {
        const chartObject = levels.dogbite.objs[1]

        expect(resolveObjectBpmAt(chartObject, 50.581538)).toBeCloseTo(500, 9)
        expect(resolveObjectBpmAt(chartObject, 61.043076)).toBeCloseTo(195, 9)
    })

    it('uses fixed absolute judgement windows in seconds', () => {
        expect(getJudgementWindows()).toEqual({
            perfect: 0.03334,
            great: 0.05,
            good: 0.06667,
            bad: 0.08333,
            miss: 0.1,
        })
    })

    it.each([
        [0.03334, 'perfect'],
        [0.03335, 'great'],
        [0.05, 'great'],
        [0.05001, 'good'],
        [0.06667, 'good'],
        [0.06668, 'bad'],
        [0.08333, 'bad'],
        [0.08334, 'miss'],
        [0.1, 'miss'],
    ] as const)('classifies a %s second delta as %s', (delta, judgement) => {
        const result = evaluateJudgements(prepareNotes([chart([0])]), [delta], delta, {})

        expect(result.judgements['0:0'].judge).toBe(judgement)
    })

    it('applies the same absolute window before and after notes at every BPM', () => {
        for (const bpm of [60, 600]) {
            const prepared = prepareNotes([chart([1], bpm)])
            const early = evaluateJudgements(prepared, [0.95], 0.95, {})
            const late = evaluateJudgements(prepared, [1.05], 1.05, {})

            expect(early.judgements['0:0'].judge).toBe('great')
            expect(late.judgements['0:0'].judge).toBe('great')
        }
    })

    it('automatically misses an unhit note when the 100ms window closes', () => {
        const prepared = prepareNotes([chart([1])])

        expect(evaluateJudgements(prepared, [], 1.09999, {}).judgements).toEqual({})
        expect(evaluateJudgements(prepared, [], 1.1, {}).judgements['0:0']).toEqual({
            judge: 'miss',
            hit: 1.1,
        })
    })

    it('creates a silent baseline for notes before an editor playtest start', () => {
        const prepared = prepareNotes([chart([1, 1.15, 1.25])])

        expect(createSkippedJudgementBaseline(prepared, 1.25)).toEqual({
            '0:0':{ judge:'miss', hit:Number.NEGATIVE_INFINITY },
            '0:1':{ judge:'miss', hit:Number.NEGATIVE_INFINITY },
        })
    })

    it('consumes a hit once and chooses the nearest eligible note', () => {
        const prepared = prepareNotes([chart([1, 1.1])])
        const result = evaluateJudgements(prepared, [1.08], 1.08, {})

        expect(result.judgements).toEqual({
            '0:1': { judge: 'perfect', hit: 1.08 },
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
