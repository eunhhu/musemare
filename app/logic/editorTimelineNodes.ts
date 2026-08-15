import type { event, obj } from '../data/types'
import { clamp } from './editorLayout'

export type TimelineNodeRef =
    | { kind:'main-event', index:number }
    | { kind:'object-event', objectIndex:number, index:number }
    | { kind:'note', objectIndex:number, index:number }

export type TimelineNodeContent = {
    events:event[]
    objects:obj[]
}

export type TimelineSelectionMode = 'replace' | 'toggle' | 'range'

export function timelineNodeKey(node:TimelineNodeRef) {
    if (node.kind === 'main-event') return `main:${node.index}`
    return `${node.kind}:${node.objectIndex}:${node.index}`
}

export function parseTimelineNodeKey(value:string):TimelineNodeRef | undefined {
    const parts = value.split(':')
    if (parts[0] === 'main' && parts.length === 2) {
        const index = Number(parts[1])
        return Number.isInteger(index) && index >= 0 ? { kind:'main-event', index } : undefined
    }
    if ((parts[0] === 'object-event' || parts[0] === 'note') && parts.length === 3) {
        const objectIndex = Number(parts[1])
        const index = Number(parts[2])
        if (!Number.isInteger(objectIndex) || objectIndex < 0 || !Number.isInteger(index) || index < 0) return
        return { kind:parts[0], objectIndex, index }
    }
}

export function uniqueTimelineNodes(nodes:TimelineNodeRef[]) {
    const seen = new Set<string>()
    return nodes.filter(node => {
        const key = timelineNodeKey(node)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

function isSameLane(left:TimelineNodeRef, right:TimelineNodeRef) {
    if (left.kind !== right.kind) return false
    if (left.kind === 'main-event' || right.kind === 'main-event') return true
    return left.objectIndex === right.objectIndex
}

function nodeAtIndex(template:TimelineNodeRef, index:number):TimelineNodeRef {
    if (template.kind === 'main-event') return { kind:'main-event', index }
    return { kind:template.kind, objectIndex:template.objectIndex, index }
}

export function selectTimelineNode(
    current:TimelineNodeRef[],
    target:TimelineNodeRef,
    mode:TimelineSelectionMode,
) {
    const targetKey = timelineNodeKey(target)
    if (mode === 'replace') return [target]
    if (mode === 'toggle') {
        return current.some(node => timelineNodeKey(node) === targetKey)
            ? current.filter(node => timelineNodeKey(node) !== targetKey)
            : [...current, target]
    }

    const anchor = current.at(-1)
    if (!anchor || !isSameLane(anchor, target)) return uniqueTimelineNodes([...current, target])
    const start = Math.min(anchor.index, target.index)
    const end = Math.max(anchor.index, target.index)
    const range = Array.from({ length:end - start + 1 }, (_, offset) => nodeAtIndex(target, start + offset))
    return uniqueTimelineNodes([...current, ...range])
}

export function allTimelineNodes(content:TimelineNodeContent):TimelineNodeRef[] {
    return [
        ...content.events.map((_, index) => ({ kind:'main-event' as const, index })),
        ...content.objects.flatMap((object, objectIndex) => [
            ...object.events.map((_, index) => ({ kind:'object-event' as const, objectIndex, index })),
            ...(object.type === 'chart' ? (object.notes ?? []).map((_, index) => ({
                kind:'note' as const,
                objectIndex,
                index,
            })) : []),
        ]),
    ]
}

export function timelineNodeStamp(content:TimelineNodeContent, node:TimelineNodeRef) {
    if (node.kind === 'main-event') return content.events[node.index]?.stamp
    const object = content.objects[node.objectIndex]
    if (node.kind === 'object-event') return object?.events[node.index]?.stamp
    return object?.notes?.[node.index]?.stamp
}

export function snapTimelineStamp(stamp:number, step:number, offset:number, endpoint:number) {
    const bounded = clamp(Number.isFinite(stamp) ? stamp : 0, 0, Math.max(0, endpoint))
    if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(offset)) return bounded
    return clamp(offset + Math.round((bounded - offset) / step) * step, 0, Math.max(0, endpoint))
}

export function moveTimelineNodes(
    content:TimelineNodeContent,
    selection:TimelineNodeRef[],
    requestedDelta:number,
    endpoint:number,
) {
    const stamps = selection
        .map(node => timelineNodeStamp(content, node))
        .filter((stamp):stamp is number => stamp !== undefined && Number.isFinite(stamp))
    if (stamps.length === 0 || !Number.isFinite(requestedDelta)) return { ...content, delta:0 }

    const minimum = Math.min(...stamps)
    const maximum = Math.max(...stamps)
    const delta = clamp(requestedDelta, -minimum, Math.max(0, endpoint) - maximum)
    if (delta === 0) return { ...content, delta }

    const selected = new Set(selection.map(timelineNodeKey))
    const movesMainEvents = content.events.some((_, index) => selected.has(`main:${index}`))
    const events = movesMainEvents
        ? content.events.map((currentEvent, index) => selected.has(`main:${index}`)
            ? { ...currentEvent, stamp:currentEvent.stamp + delta }
            : currentEvent
        )
        : content.events
    const objects = content.objects.map((object, objectIndex) => {
        const movesObjectEvents = object.events.some((_, index) => selected.has(`object-event:${objectIndex}:${index}`))
        const movesNotes = object.notes?.some((_, index) => selected.has(`note:${objectIndex}:${index}`)) ?? false
        const objectEvents = movesObjectEvents
            ? object.events.map((currentEvent, index) => selected.has(`object-event:${objectIndex}:${index}`)
                ? { ...currentEvent, stamp:currentEvent.stamp + delta }
                : currentEvent
            )
            : object.events
        const notes = movesNotes
            ? object.notes?.map((note, index) => selected.has(`note:${objectIndex}:${index}`)
                ? { ...note, stamp:note.stamp + delta }
                : note
            )
            : object.notes
        return objectEvents === object.events && notes === object.notes
            ? object
            : { ...object, events:objectEvents, notes }
    })

    return { events, objects, delta }
}

function sortedLane<T extends { stamp:number }>(items:T[]) {
    const decorated = items.map((item, oldIndex) => ({ item, oldIndex }))
    decorated.sort((left, right) => left.item.stamp - right.item.stamp || left.oldIndex - right.oldIndex)
    return {
        items:decorated.map(entry => entry.item),
        indexes:new Map(decorated.map((entry, newIndex) => [entry.oldIndex, newIndex])),
    }
}

export function sortTimelineNodes(
    content:TimelineNodeContent,
    selection:TimelineNodeRef[],
) {
    const remapped = new Map<string, TimelineNodeRef>()
    const main = sortedLane(content.events)
    main.indexes.forEach((newIndex, oldIndex) => {
        remapped.set(`main:${oldIndex}`, { kind:'main-event', index:newIndex })
    })

    const objects = content.objects.map((object, objectIndex) => {
        const objectEvents = sortedLane(object.events)
        objectEvents.indexes.forEach((newIndex, oldIndex) => {
            remapped.set(`object-event:${objectIndex}:${oldIndex}`, { kind:'object-event', objectIndex, index:newIndex })
        })
        if (object.type !== 'chart') return { ...object, events:objectEvents.items }

        const notes = sortedLane(object.notes ?? [])
        notes.indexes.forEach((newIndex, oldIndex) => {
            remapped.set(`note:${objectIndex}:${oldIndex}`, { kind:'note', objectIndex, index:newIndex })
        })
        return { ...object, events:objectEvents.items, notes:notes.items }
    })

    return {
        events:main.items,
        objects,
        selection:selection.flatMap(node => {
            const next = remapped.get(timelineNodeKey(node))
            return next ? [next] : []
        }),
    }
}

export function deleteTimelineNodes(
    content:TimelineNodeContent,
    selection:TimelineNodeRef[],
):TimelineNodeContent {
    const selected = new Set(selection.map(timelineNodeKey))
    return {
        events:content.events.filter((_, index) => !selected.has(`main:${index}`)),
        objects:content.objects.map((object, objectIndex) => ({
            ...object,
            events:object.events.filter((_, index) => !selected.has(`object-event:${objectIndex}:${index}`)),
            notes:object.notes?.filter((_, index) => !selected.has(`note:${objectIndex}:${index}`)),
        })),
    }
}
