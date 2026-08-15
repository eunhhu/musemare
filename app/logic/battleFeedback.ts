import type { JudgementRecord, JudgementState, NoteId } from './battleDomain'

export const judgementFeedbackDuration = 0.62

export type JudgementFeedbackVisual = {
    label:string
    color:number
    particleCount:number
    strength:number
}

export type JudgementFeedbackFrame = {
    progress:number
    textAlpha:number
    textScale:number
    textY:number
    impactAlpha:number
    ringRadius:number
    particleDistance:number
}

export type RecentJudgement = {
    noteId:NoteId
    record:JudgementRecord
}

export const judgementFeedbackVisuals:Record<JudgementRecord['judge'], JudgementFeedbackVisual> = {
    perfect:{ label:'PERFECT', color:0x7cff6b, particleCount:12, strength:1 },
    great:{ label:'GREAT', color:0x6bdfff, particleCount:10, strength:0.9 },
    good:{ label:'GOOD', color:0xffe45e, particleCount:8, strength:0.78 },
    bad:{ label:'BAD', color:0xff9d4d, particleCount:6, strength:0.66 },
    miss:{ label:'MISS', color:0xff5b6e, particleCount:8, strength:0.82 },
}

function clamp01(value:number) {
    return Math.min(1, Math.max(0, value))
}

function easeOutCubic(value:number) {
    return 1 - (1 - value) ** 3
}

function easeOutBack(value:number) {
    const overshoot = 1.70158
    const shifted = value - 1
    return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2
}

export function getJudgementFeedbackFrame(
    record:JudgementRecord,
    timeline:number,
):JudgementFeedbackFrame | undefined {
    if (!Number.isFinite(record.hit)) return undefined
    const age = timeline - record.hit
    if (age < 0 || age >= judgementFeedbackDuration) return undefined

    const progress = clamp01(age / judgementFeedbackDuration)
    const entrance = clamp01(age / 0.08)
    const reveal = clamp01(age / 0.025)
    const fade = 1 - clamp01((progress - 0.58) / 0.42) ** 2
    const travel = easeOutCubic(progress)

    return {
        progress,
        textAlpha:reveal * fade,
        textScale:0.72 + easeOutBack(entrance) * 0.34,
        textY:-50 - travel * 20,
        impactAlpha:(1 - progress) ** 2,
        ringRadius:10 + travel * 44,
        particleDistance:8 + travel * 42,
    }
}

export function getRecentJudgementsForObject(
    objectIndex:number,
    judgements:JudgementState,
    timeline:number,
):RecentJudgement[] {
    const prefix = `${objectIndex}:`
    return Object.entries(judgements)
        .flatMap(([noteId, record]) => {
            if (!noteId.startsWith(prefix) || !getJudgementFeedbackFrame(record, timeline)) return []
            return [{ noteId:noteId as NoteId, record }]
        })
        .sort((left, right) => left.record.hit - right.record.hit || left.noteId.localeCompare(right.noteId))
}
