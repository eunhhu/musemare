import type { judge, obj } from '../data/types'
import { calcEventValue } from '../data/utils'

export const MAX_PENDING_HITS = 64
const MAX_HIT_RETENTION_SECONDS = 2

export type NoteId = `${number}:${number}`

export type PreparedNote = {
    id: NoteId
    objectIndex: number
    noteIndex: number
    stamp: number
    beatDuration: number
}

export type JudgementRecord = {
    judge: Exclude<judge, 'none'>
    hit: number
}

export type JudgementState = Record<NoteId, JudgementRecord>

export type JudgementWindows = {
    perfect: number
    good: number
    miss: number
}

type AudioPlaybackState = {
    paused:boolean
    ended:boolean
    readyState:number
    seeking?:boolean
}

type AudioTimelineState = {
    currentTime:number
}

function rounded(value: number) {
    return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000
}

export function getJudgementWindows(beatDuration: number): JudgementWindows {
    const tempoScale = 1 + ((0.4 / beatDuration - 1) / 2)

    return {
        perfect: rounded((beatDuration * 1 / 5) * tempoScale),
        good: rounded((beatDuration * 3 / 5) * tempoScale),
        miss: rounded(beatDuration * tempoScale),
    }
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
            beatDuration:60 / resolveObjectBpmAt(object, note.stamp),
        }))
    }).sort((left, right) => left.stamp - right.stamp)
}

function judgeDelta(delta: number, windows: JudgementWindows): JudgementRecord['judge'] | undefined {
    if (delta <= windows.perfect) {
        return 'perfect'
    }
    if (delta < windows.good) {
        return 'good'
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
    const longestWindow = notes.reduce(
        (longest, note) => Math.max(longest, getJudgementWindows(note.beatDuration).miss),
        0,
    )
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
            if (notes[middle].stamp < hit - longestWindow) left = middle + 1
            else right = middle
        }

        for (let noteIndex = left; noteIndex < notes.length; noteIndex += 1) {
            const note = notes[noteIndex]
            if (note.stamp > hit + longestWindow) break
            if (assignedNotes.has(note.id)) {
                continue
            }

            const delta = Math.abs(hit - note.stamp)
            if (delta <= getJudgementWindows(note.beatDuration).miss && delta < closestDelta) {
                closestNote = note
                closestDelta = delta
            }
        }

        if (!closestNote) {
            return
        }

        const judgement = judgeDelta(closestDelta, getJudgementWindows(closestNote.beatDuration))
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

        const windows = getJudgementWindows(note.beatDuration)
        if (timeline - note.stamp >= windows.good) {
            recordJudgement(note.id, {
                judge: 'miss',
                hit: note.stamp + windows.good,
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
