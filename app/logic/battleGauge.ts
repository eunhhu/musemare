import type { judge } from '../data/types'
import { evaluateJudgements, type JudgementState, type NoteId, type PreparedNote } from './battleDomain'

export type ScoredJudgement = Exclude<judge, 'none'>

export type BattleGaugeState = {
    health:number
    failed:boolean
}

export type BattleGaugeEvent = {
    noteId:NoteId
    stamp:number
    judgement:ScoredJudgement
}

export const battleGaugeMaximum = 100

export const battleGaugeDelta:Record<ScoredJudgement, number> = {
    miss:-10,
    bad:-1,
    good:1,
    great:2,
    perfect:3,
}

export function createBattleGaugeState():BattleGaugeState {
    return { health:battleGaugeMaximum, failed:false }
}

export function collectNewGaugeEvents(
    notes:PreparedNote[],
    previous:JudgementState,
    next:JudgementState,
):BattleGaugeEvent[] {
    const noteStamps = new Map(notes.map(note => [note.id, note.stamp]))
    return Object.entries(next).flatMap(([noteId, record]) => {
        if (Object.hasOwn(previous, noteId)) return []
        const stamp = noteStamps.get(noteId as NoteId)
        return stamp === undefined ? [] : [{
            noteId:noteId as NoteId,
            stamp,
            judgement:record.judge,
        }]
    })
}

export function applyBattleGaugeEvents(
    state:BattleGaugeState,
    events:BattleGaugeEvent[],
):BattleGaugeState {
    if (state.failed || events.length === 0) return state

    const ordered = [...events].sort((left, right) => (
        left.stamp - right.stamp || left.noteId.localeCompare(right.noteId)
    ))
    let health = state.health
    let index = 0

    while (index < ordered.length) {
        const stamp = ordered[index].stamp
        let delta = 0
        while (index < ordered.length && ordered[index].stamp === stamp) {
            delta += battleGaugeDelta[ordered[index].judgement]
            index += 1
        }

        health = Math.min(battleGaugeMaximum, health + delta)
        if (health <= 0) return { health:0, failed:true }
    }

    return health === state.health ? state : { health, failed:false }
}

export function advanceBattleFrame(
    notes:PreparedNote[],
    hits:number[],
    timeline:number,
    judgements:JudgementState,
    gauge:BattleGaugeState,
) {
    const evaluated = evaluateJudgements(notes, hits, timeline, judgements)
    return {
        ...evaluated,
        gauge:applyBattleGaugeEvents(
            gauge,
            collectNewGaugeEvents(notes, judgements, evaluated.judgements),
        ),
    }
}
