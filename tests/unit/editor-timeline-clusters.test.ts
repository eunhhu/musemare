import { describe, expect, it } from 'vitest'
import { clusterTimelineItems, fanTimelineCluster } from '../../app/logic/editorTimelineClusters'

describe('editor timeline clusters', () => {
    it('groups markers that would collide while preserving their time range', () => {
        const clusters = clusterTimelineItems('main', [
            { node:{ kind:'main-event', index:0 }, stamp:1, pixel:100, data:'a' },
            { node:{ kind:'main-event', index:1 }, stamp:1, pixel:100, data:'b' },
            { node:{ kind:'main-event', index:2 }, stamp:1.01, pixel:118, data:'c' },
            { node:{ kind:'main-event', index:3 }, stamp:2, pixel:180, data:'d' },
        ], 22)

        expect(clusters).toHaveLength(2)
        expect(clusters[0].items.map(item => item.data)).toEqual(['a', 'b', 'c'])
        expect(clusters[0]).toMatchObject({ anchorPixel:106, startStamp:1, endStamp:1.01 })
    })

    it('fans toward available space at either viewport edge', () => {
        expect(fanTimelineCluster(0, 3, 200)).toEqual([23, 46, 69])
        expect(fanTimelineCluster(195, 3, 200)).toEqual([126, 149, 172])
    })

    it('compresses oversized fans without escaping the viewport', () => {
        const positions = fanTimelineCluster(50, 10, 100)
        expect(positions[0]).toBeGreaterThanOrEqual(2)
        expect(positions.at(-1)!).toBeLessThanOrEqual(80)
    })
})
