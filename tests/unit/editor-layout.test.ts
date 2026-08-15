import { describe, expect, it } from 'vitest'
import { clampEditorPanel, timelineScrollMetrics } from '../../app/logic/editorLayout'

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
})
