import { describe, expect, it } from 'vitest'
import { createSkippedJudgementBaseline, type JudgementState, type PreparedNote } from '../../app/logic/battleDomain'
import {
    advanceBattleFrame,
    applyBattleGaugeEvents,
    battleGaugeDelta,
    collectNewGaugeEvents,
    createBattleGaugeState,
    type BattleGaugeEvent,
} from '../../app/logic/battleGauge'

function event(
    noteId:BattleGaugeEvent['noteId'],
    stamp:number,
    judgement:BattleGaugeEvent['judgement'],
):BattleGaugeEvent {
    return { noteId, stamp, judgement }
}

describe('battle health gauge', () => {
    it('starts full and uses the requested judgement deltas', () => {
        expect(createBattleGaugeState()).toEqual({ health:100, failed:false })
        expect(battleGaugeDelta).toEqual({
            miss:-10,
            bad:-1,
            good:1,
            great:2,
            perfect:3,
        })
    })

    it('caps recovery at 100', () => {
        const result = applyBattleGaugeEvents(
            { health:99, failed:false },
            [event('0:0', 1, 'perfect')],
        )

        expect(result).toEqual({ health:100, failed:false })
    })

    it('latches failure after health reaches zero and never revives', () => {
        const misses = Array.from({ length:10 }, (_, index) => event(
            `0:${index}` as const,
            index,
            'miss',
        ))
        const failed = applyBattleGaugeEvents(createBattleGaugeState(), misses)

        expect(failed).toEqual({ health:0, failed:true })
        expect(applyBattleGaugeEvents(failed, [event('1:0', 20, 'perfect')])).toBe(failed)
    })

    it('applies simultaneous chord judgements as one health change', () => {
        const survived = applyBattleGaugeEvents(
            { health:8, failed:false },
            [event('0:0', 1, 'miss'), event('1:0', 1, 'perfect')],
        )
        const failed = applyBattleGaugeEvents(
            { health:8, failed:false },
            [event('0:0', 1, 'miss'), event('1:0', 2, 'perfect')],
        )

        expect(survived).toEqual({ health:1, failed:false })
        expect(failed).toEqual({ health:0, failed:true })
    })

    it('collects only newly assigned notes with their chart timestamps', () => {
        const notes:PreparedNote[] = [
            { id:'0:0', objectIndex:0, noteIndex:0, stamp:1 },
            { id:'1:0', objectIndex:1, noteIndex:0, stamp:1 },
        ]
        const previous:JudgementState = { '0:0':{ judge:'great', hit:1.1 } }
        const next:JudgementState = {
            ...previous,
            '1:0':{ judge:'bad', hit:1.4 },
        }

        expect(collectNewGaugeEvents(notes, previous, next)).toEqual([
            { noteId:'1:0', stamp:1, judgement:'bad' },
        ])
    })

    it('does not charge health for notes skipped before an editor playtest segment', () => {
        const notes:PreparedNote[] = [
            { id:'0:0', objectIndex:0, noteIndex:0, stamp:1 },
            { id:'0:1', objectIndex:0, noteIndex:1, stamp:2 },
        ]
        const baseline = createSkippedJudgementBaseline(notes, 1.2)
        const result = advanceBattleFrame(notes, [], 2.1, baseline, createBattleGaugeState())

        expect(result.judgements['0:0']).toEqual({ judge:'miss', hit:Number.NEGATIVE_INFINITY })
        expect(result.judgements['0:1'].judge).toBe('miss')
        expect(result.gauge).toEqual({ health:90, failed:false })
    })
})
