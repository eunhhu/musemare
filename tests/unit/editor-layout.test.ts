import { describe, expect, it } from 'vitest'
import {
    clampEditorPanel,
    consumeWheelRows,
    isTimelineMarkerVisible,
    timelinePixelAt,
    timelineScrollMetrics,
    timelineStampAtPixel,
} from '../../app/logic/editorLayout'

describe('editor layout bounds', () => {
    const layout = { underbar:30, mainset:20, eventset:20, objects:20 }

    it('keeps a usable scene between side panels', () => {
        expect(clampEditorPanel('mainset', 99, layout)).toBe(60)
        expect(clampEditorPanel('eventset', 99, layout)).toBe(60)
        expect(clampEditorPanel('underbar', -10, layout)).toBe(10)
        expect(clampEditorPanel('objects', 100, layout)).toBe(80)
    })

    it('produces finite scrollbar geometry at the default zoom', () => {
        expect(timelineScrollMetrics(800, 100, -200)).toEqual({
            contentWidth:800,
            maxScroll:0,
            scroll:0,
            thumbWidth:800,
            thumbTravel:0,
            thumbLeft:0,
        })
    })

    it('clamps scrolling to zoomed content bounds', () => {
        expect(timelineScrollMetrics(800, 200, -900)).toMatchObject({
            maxScroll:800,
            scroll:-800,
            thumbWidth:400,
            thumbLeft:400,
        })
    })

    it('uses one reversible timeline coordinate system at every zoom and scroll', () => {
        const pixel = timelinePixelAt(45, 90, 800, 200, -300)

        expect(pixel).toBe(500)
        expect(timelineStampAtPixel(pixel, 90, 800, 200, -300)).toBe(45)
        expect(timelineStampAtPixel(-100, 90, 800, 200, -300)).toBeCloseTo(11.25)
        expect(timelineStampAtPixel(2_000, 90, 800, 200, -300)).toBe(90)
    })

    it('clips timeline markers on both sides while keeping partially visible handles', () => {
        expect(isTimelineMarkerVisible(-20, 800, 8)).toBe(false)
        expect(isTimelineMarkerVisible(-4, 800, 8)).toBe(true)
        expect(isTimelineMarkerVisible(804, 800, 8)).toBe(true)
        expect(isTimelineMarkerVisible(820, 800, 8)).toBe(false)
    })

    it('accumulates trackpad movement into stable whole-row scrolling', () => {
        expect(consumeWheelRows(0, 30)).toEqual({ rows:0, remainder:30 })
        expect(consumeWheelRows(30, 60)).toEqual({ rows:1, remainder:10 })
        expect(consumeWheelRows(10, -170)).toEqual({ rows:-2, remainder:0 })
    })
})
