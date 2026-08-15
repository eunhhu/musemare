import { useCallback, useEffect, useRef, useState } from 'react'
import { isInRange } from '../data/utils'
import { clamp, clampEditorPanel } from '../logic/editorLayout'

const dragRange = 6

export function useEditorLayout() {
    const [underbarLine, setUnderbarLine] = useState(30)
    const [mainsetLine, setMainsetLine] = useState(20)
    const [eventsetLine, setEventsetLine] = useState(20)
    const [objLine, setObjLine] = useState(20)
    const [viewportSize, setViewportSize] = useState<[number, number]>([0, 0])
    const [stageSize, setStageSize] = useState<[number, number]>([0, 0])
    const [zoom, setZoom] = useState(100)
    const zoomRef = useRef(100)
    const layoutRef = useRef({
        underbar:30,
        mainset:20,
        eventset:20,
        objects:20,
        dragging:'',
        controlsDragging:false,
        scrollbarDragging:false,
        scrollbarGrabOffset:0,
    })

    const setEditorZoom = useCallback((value:number) => {
        const next = clamp(value, 100, 800)
        zoomRef.current = next
        setZoom(next)
    }, [])

    useEffect(() => {
        const layout = layoutRef.current
        const resizeCanvas = () => {
            setViewportSize([innerWidth, innerHeight])
            setStageSize([
                Math.max(1, innerWidth / 100 * (100 - layout.mainset - layout.eventset)),
                Math.max(1, innerHeight / 100 * (100 - layout.underbar)),
            ])
        }
        const mouseup = () => {
            layout.dragging = ''
        }
        const mousedown = (event:MouseEvent) => {
            if (isInRange(event.clientY, dragRange, innerHeight / 100 * (100 - layout.underbar))) {
                layout.dragging = 'underbar'
            } else if (isInRange(event.clientX, dragRange, innerWidth / 100 * layout.mainset) && event.clientY < innerHeight / 100 * (100 - layout.underbar)) {
                layout.dragging = 'mainset'
            } else if (isInRange(event.clientX, dragRange, innerWidth / 100 * (100 - layout.eventset)) && event.clientY < innerHeight / 100 * (100 - layout.underbar)) {
                layout.dragging = 'eventset'
            } else if (isInRange(event.clientX, dragRange, innerWidth / 100 * layout.objects) && event.clientY > innerHeight / 100 * (100 - layout.underbar)) {
                layout.dragging = 'objects'
            }
        }
        const mousemove = (event:MouseEvent) => {
            if (layout.dragging) {
                if (layout.dragging === 'underbar') {
                    layout.underbar = clampEditorPanel('underbar', 100 - 100 * event.clientY / innerHeight, layout)
                    setUnderbarLine(layout.underbar)
                } else if (layout.dragging === 'mainset') {
                    layout.mainset = clampEditorPanel('mainset', 100 * event.clientX / innerWidth, layout)
                    setMainsetLine(layout.mainset)
                } else if (layout.dragging === 'eventset') {
                    layout.eventset = clampEditorPanel('eventset', 100 - 100 * event.clientX / innerWidth, layout)
                    setEventsetLine(layout.eventset)
                } else {
                    layout.objects = clampEditorPanel('objects', 100 * event.clientX / innerWidth, layout)
                    setObjLine(layout.objects)
                }
                resizeCanvas()
                return
            }

            const overHorizontal = isInRange(event.clientY, dragRange, innerHeight / 100 * (100 - layout.underbar))
            const overMain = isInRange(event.clientX, dragRange, innerWidth / 100 * layout.mainset) && event.clientY < innerHeight / 100 * (100 - layout.underbar)
            const overEvents = isInRange(event.clientX, dragRange, innerWidth / 100 * (100 - layout.eventset)) && event.clientY < innerHeight / 100 * (100 - layout.underbar)
            const overObjects = isInRange(event.clientX, dragRange, innerWidth / 100 * layout.objects) && event.clientY > innerHeight / 100 * (100 - layout.underbar)
            document.body.style.cursor = overHorizontal ? 'n-resize' : overMain || overEvents || overObjects ? 'e-resize' : 'unset'
        }
        const contextmenu = (event:Event) => event.preventDefault()

        window.addEventListener('resize', resizeCanvas)
        document.addEventListener('contextmenu', contextmenu)
        document.addEventListener('mousemove', mousemove)
        document.addEventListener('mousedown', mousedown)
        document.addEventListener('mouseup', mouseup)
        resizeCanvas()

        return () => {
            window.removeEventListener('resize', resizeCanvas)
            document.removeEventListener('contextmenu', contextmenu)
            document.removeEventListener('mousemove', mousemove)
            document.removeEventListener('mousedown', mousedown)
            document.removeEventListener('mouseup', mouseup)
            document.body.style.cursor = 'unset'
        }
    }, [])

    const resetZoom = useCallback(() => {
        setEditorZoom(100)
    }, [setEditorZoom])

    return {
        underbarLine,
        mainsetLine,
        eventsetLine,
        objLine,
        viewportSize,
        stageSize,
        zoom,
        zoomRef,
        setEditorZoom,
        layoutRef,
        resetZoom,
    }
}
