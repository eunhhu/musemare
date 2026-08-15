import type { judge, obj } from '../data/types'
import { calcEventValue } from '../data/utils'

export const MAX_PENDING_HITS = 64
const MAX_HIT_RETENTION_SECONDS = 2
const TIMING_PRECISION = 1_000_000_000
const TIMING_EPSILON_SECONDS = 1 / TIMING_PRECISION

export type NoteId = `${number}:${number}`

export type PreparedNote = {
    id: NoteId
    objectIndex: number
    noteIndex: number
    stamp: number
}

export type JudgementRecord = {
    judge: Exclude<judge, 'none'>
    hit: number
}

export type JudgementState = Record<NoteId, JudgementRecord>

export type JudgementWindows = {
    perfect: number
    great: number
    good: number
    bad: number
    miss: number
}

const JUDGEMENT_WINDOWS = Object.freeze({
    perfect: 0.03334,
    great: 0.05,
    good: 0.06667,
    bad: 0.08333,
    miss: 0.1,
}) satisfies JudgementWindows

type AudioPlaybackState = {
    paused:boolean
    ended:boolean
    readyState:number
    seeking?:boolean
}

type AudioTimelineState = {
    currentTime:number
}

export function getJudgementWindows(): Readonly<JudgementWindows> {
    return JUDGEMENT_WINDOWS
}

function normalizeTiming(value:number) {
    return Math.round(value * TIMING_PRECISION) / TIMING_PRECISION
}

export function resolveObjectBpmAt(object:obj, timeline:number) {
    let bpm = Number(object.bpm)
    for (const event of object.events) {
        if (event.type !== 'bpm' || timeline < event.stamp) continue
        const duration = 60 / Number(event.duration)
        bpm = calcEventValue(timeline, event.stamp, duration, bpm, Number(event.value), event.ease)
    }
    return bpm
}

export function isAudioActivelyPlaying(audio:AudioPlaybackState | null | undefined) {
    return Boolean(audio && !audio.paused && !audio.ended && !audio.seeking && audio.readyState >= 3)
}

export function timelineStampFromAudio(audio:AudioTimelineState, offset:number) {
    return audio.currentTime - offset
}

export function prunePendingHits(
    hits:number[],
    timeline:number,
    retentionSeconds = MAX_HIT_RETENTION_SECONDS,
) {
    const oldestRelevantHit = timeline - Math.max(retentionSeconds, 0)
    return hits
        .filter(hit => Number.isFinite(hit) && hit >= oldestRelevantHit)
        .slice(-MAX_PENDING_HITS)
}

export function enqueuePendingHit(hits:number[], hit:number, timeline:number) {
    if (!Number.isFinite(hit)) return prunePendingHits(hits, timeline)
    return prunePendingHits([...hits, hit], timeline)
}

export function prepareNotes(objects: obj[]): PreparedNote[] {
    return objects.flatMap((object, objectIndex) => {
        if (object.type !== 'chart' || !object.notes || !object.bpm) {
            return []
        }

        return object.notes.map((note, noteIndex) => ({
            id: `${objectIndex}:${noteIndex}` as NoteId,
            objectIndex,
            noteIndex,
            stamp: note.stamp,
        }))
    }).sort((left, right) => left.stamp - right.stamp)
}

export function createSkippedJudgementBaseline(notes:PreparedNote[], timeline:number):JudgementState {
    const missWindow = getJudgementWindows().miss
    return notes.reduce<JudgementState>((baseline, note) => {
        if (normalizeTiming(timeline - note.stamp) < missWindow) return baseline
        baseline[note.id] = {
            judge:'miss',
            hit:Number.NEGATIVE_INFINITY,
        }
        return baseline
    }, {})
}

function judgeDelta(delta: number, windows: JudgementWindows): JudgementRecord['judge'] | undefined {
    if (delta <= windows.perfect) {
        return 'perfect'
    }
    if (delta <= windows.great) {
        return 'great'
    }
    if (delta <= windows.good) {
        return 'good'
    }
    if (delta <= windows.bad) {
        return 'bad'
    }
    if (delta <= windows.miss) {
        return 'miss'
    }
}

export function evaluateJudgements(
    notes: PreparedNote[],
    hits: number[],
    timeline: number,
    previous: JudgementState,
) {
    let judgements = previous
    const consumedHits = new Set<number>()
    const assignedNotes = new Set<NoteId>(Object.keys(previous) as NoteId[])
    const windows = getJudgementWindows()
    const longestWindow = windows.miss
    const orderedHits = prunePendingHits(
        hits,
        timeline,
        longestWindow || MAX_HIT_RETENTION_SECONDS,
    ).sort((left, right) => left - right)
    const recordJudgement = (noteId:NoteId, record:JudgementRecord) => {
        if (judgements === previous) {
            judgements = { ...previous }
        }
        judgements[noteId] = record
    }

    orderedHits.forEach((hit, hitIndex) => {
        let closestNote: PreparedNote | undefined
        let closestDelta = Number.POSITIVE_INFINITY
        let left = 0
        let right = notes.length
        while (left < right) {
            const middle = Math.floor((left + right) / 2)
            if (notes[middle].stamp < hit - longestWindow - TIMING_EPSILON_SECONDS) left = middle + 1
            else right = middle
        }

        for (let noteIndex = left; noteIndex < notes.length; noteIndex += 1) {
            const note = notes[noteIndex]
            if (note.stamp > hit + longestWindow + TIMING_EPSILON_SECONDS) break
            if (assignedNotes.has(note.id)) {
                continue
            }

            const delta = normalizeTiming(Math.abs(hit - note.stamp))
            if (delta <= longestWindow && delta < closestDelta) {
                closestNote = note
                closestDelta = delta
            }
        }

        if (!closestNote) {
            return
        }

        const judgement = judgeDelta(closestDelta, windows)
        if (!judgement) {
            return
        }

        recordJudgement(closestNote.id, { judge: judgement, hit })
        assignedNotes.add(closestNote.id)
        consumedHits.add(hitIndex)
    })

    for (const note of notes) {
        if (note.stamp > timeline) break
        if (assignedNotes.has(note.id)) {
            continue
        }

        if (normalizeTiming(timeline - note.stamp) >= windows.miss) {
            recordJudgement(note.id, {
                judge: 'miss',
                hit: note.stamp + windows.miss,
            })
            assignedNotes.add(note.id)
        }
    }

    const pendingHits = prunePendingHits(
        orderedHits.filter((_, hitIndex) => !consumedHits.has(hitIndex)),
        timeline,
        longestWindow || MAX_HIT_RETENTION_SECONDS,
    )

    return { judgements, pendingHits }
}
