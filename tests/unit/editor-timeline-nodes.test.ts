import { describe, expect, it } from 'vitest'
import type { event, obj } from '../../app/data/types'
import {
    alignTimelineNodes,
    allTimelineNodes,
    deleteTimelineNodes,
    moveTimelineNodes,
    parseTimelineNodeKey,
    selectTimelineNode,
    snapTimelineStamp,
    sortTimelineNodes,
    timelineNodeKey,
    type TimelineNodeContent,
    type TimelineNodeRef,
} from '../../app/logic/editorTimelineNodes'

function chart(noteStamps:number[], eventStamps:number[] = []):obj {
    return {
        type:'chart',
        bpm:120,
        notes:noteStamps.map(stamp => ({ stamp, hit:0, judge:'none' })),
        events:eventStamps.map(stamp => ({ stamp, type:'visible', value:true })),
        position:[50, 50], rotate:0, scale:[1, 1], opacity:1, anchor:[0, 0], visible:true,
    }
}

function mainEvent(stamp:number):event {
    return { stamp, type:'bgcolor', value:'#000000' }
}

function content():TimelineNodeContent {
    return {
        events:[mainEvent(1), mainEvent(3)],
        objects:[chart([1, 2, 4], [2])],
    }
}

describe('editor timeline node operations', () => {
    it('serializes node references and rejects malformed keys', () => {
        const node:TimelineNodeRef = { kind:'note', objectIndex:2, index:4 }
        expect(parseTimelineNodeKey(timelineNodeKey(node))).toEqual(node)
        expect(parseTimelineNodeKey('note:-1:2')).toBeUndefined()
        expect(parseTimelineNodeKey('wat:1')).toBeUndefined()
    })

    it('toggles nodes and extends a range inside one lane', () => {
        const first:TimelineNodeRef = { kind:'note', objectIndex:0, index:0 }
        const third:TimelineNodeRef = { kind:'note', objectIndex:0, index:2 }
        const toggled = selectTimelineNode([first], third, 'toggle')

        expect(toggled).toEqual([first, third])
        expect(selectTimelineNode(toggled, first, 'toggle')).toEqual([third])
        expect(selectTimelineNode([first], third, 'range')).toEqual([
            first,
            { kind:'note', objectIndex:0, index:1 },
            third,
        ])
    })

    it('moves every selected node by one shared clamped delta', () => {
        const source = content()
        const selection:TimelineNodeRef[] = [
            { kind:'main-event', index:0 },
            { kind:'note', objectIndex:0, index:1 },
        ]
        const moved = moveTimelineNodes(source, selection, -5, 8)

        expect(moved.delta).toBe(-1)
        expect(moved.events.map(value => value.stamp)).toEqual([0, 3])
        expect(moved.objects[0].notes?.map(value => value.stamp)).toEqual([1, 1, 4])
    })

    it('sorts moved lanes and remaps the selected indexes', () => {
        const source = content()
        const selection:TimelineNodeRef[] = [{ kind:'note', objectIndex:0, index:2 }]
        const moved = moveTimelineNodes(source, selection, -3.5, 8)
        const sorted = sortTimelineNodes(moved, selection)

        expect(sorted.objects[0].notes?.map(note => note.stamp)).toEqual([0.5, 1, 2])
        expect(sorted.selection).toEqual([{ kind:'note', objectIndex:0, index:0 }])
    })

    it('deletes mixed selections without touching adjacent nodes', () => {
        const source = content()
        const deleted = deleteTimelineNodes(source, [
            { kind:'main-event', index:1 },
            { kind:'object-event', objectIndex:0, index:0 },
            { kind:'note', objectIndex:0, index:1 },
        ])

        expect(deleted.events.map(value => value.stamp)).toEqual([1])
        expect(deleted.objects[0].events).toEqual([])
        expect(deleted.objects[0].notes?.map(note => note.stamp)).toEqual([1, 4])
    })

    it('enumerates every selectable node and snaps safely to the grid', () => {
        expect(allTimelineNodes(content())).toHaveLength(6)
        expect(snapTimelineStamp(1.13, 0.25, 0, 4)).toBe(1.25)
        expect(snapTimelineStamp(-2, 0.25, 0, 4)).toBe(0)
        expect(snapTimelineStamp(8, 0.25, 0, 4)).toBe(4)
    })

    it('aligns a mixed selection to its active node and remaps sorted indexes', () => {
        const aligned = alignTimelineNodes(content(), [
            { kind:'main-event', index:0 },
            { kind:'note', objectIndex:0, index:2 },
        ])

        expect(aligned.events.map(value => value.stamp)).toEqual([3, 4])
        expect(aligned.objects[0].notes?.map(value => value.stamp)).toEqual([1, 2, 4])
        expect(aligned.selection).toEqual([
            { kind:'main-event', index:1 },
            { kind:'note', objectIndex:0, index:2 },
        ])
    })
})
