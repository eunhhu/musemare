import { describe, expect, it } from 'vitest'
import {
    buildTimelineRulerMarks,
    clampEditorPanel,
    consumeWheelRows,
    formatTimelineTime,
    isTimelineMarkerVisible,
    timelinePixelAt,
    timelineScrollMetrics,
    timelineStampAtPixel,
    zoomTimelineAtPixel,
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

    it('keeps the timestamp under the pointer stable while zooming', () => {
        const result = zoomTimelineAtPixel(800, 80, 100, 0, 400, 200)
        expect(result).toMatchObject({ zoom:200, scroll:-400, anchorStamp:40 })
        expect(timelineStampAtPixel(400, 80, 800, result.zoom, result.scroll)).toBeCloseTo(40)
    })

    it('builds readable ruler labels only for the visible range', () => {
        expect(formatTimelineTime(65.2, 1)).toBe('01:05.2')
        expect(formatTimelineTime(59.96, 1)).toBe('01:00.0')
        const marks = buildTimelineRulerMarks(800, 80, 200, -400)
        expect(marks[0].stamp).toBeGreaterThanOrEqual(20)
        expect(marks.at(-1)!.stamp).toBeLessThanOrEqual(60)
        expect(marks.length).toBeLessThan(20)
    })
})
