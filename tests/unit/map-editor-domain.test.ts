import { describe, expect, it } from 'vitest'
import {
    clientPointToWorld,
    normalizeDragRectangle,
    screenToWorld,
    worldToScreen,
} from '../../app/logic/mapEditorDomain'

describe('map editor drag rectangles', () => {
    it('does not resize on a click without a drag', () => {
        expect(normalizeDragRectangle([20, 30], [20, 30])).toBeUndefined()
    })

    it('normalizes reverse-direction drags', () => {
        expect(normalizeDragRectangle([80, 70], [20, 10])).toEqual({
            x:20,
            y:10,
            width:60,
            height:60,
        })
    })

    it('round-trips the exact explore camera translation, rotation, and scale', () => {
        const stageSize:[number, number] = [1200, 800]
        const camera = { position:[150, -75] as [number, number], rotation:30, scale:1.5, follow:'' }
        const world:[number, number] = [230, 45]
        const screen = worldToScreen(world, stageSize, camera)

        expect(screen[0]).toBeCloseTo(616.707658, 6)
        expect(screen[1]).toBeCloseTo(659.061487, 6)
        expect(screenToWorld(screen, stageSize, camera)).toEqual(expect.arrayContaining([
            expect.closeTo(world[0], 8),
            expect.closeTo(world[1], 8),
        ]))
    })

    it('maps client coordinates through the rendered canvas rectangle before camera inversion', () => {
        const stageSize:[number, number] = [1200, 800]
        const camera = { position:[150, -75] as [number, number], rotation:30, scale:1.5, follow:'' }
        const world:[number, number] = [230, 45]
        const screen = worldToScreen(world, stageSize, camera)
        const rect = { left:200, top:100, width:600, height:400 }
        const client:[number, number] = [
            rect.left + screen[0] / 2,
            rect.top + screen[1] / 2,
        ]

        expect(clientPointToWorld(client, rect, stageSize, camera)).toEqual(expect.arrayContaining([
            expect.closeTo(world[0], 8),
            expect.closeTo(world[1], 8),
        ]))
    })

    it('rejects non-invertible camera scales', () => {
        const camera = { position:[0, 0] as [number, number], rotation:0, scale:0, follow:'' }
        expect(screenToWorld([10, 10], [1000, 1000], camera)).toBeUndefined()
    })
})
