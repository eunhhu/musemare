import { useCallback, useEffect, useRef, useState } from 'react'
import { isInRange } from '../data/utils'
import { clamp, clampEditorPanel } from '../logic/editorLayout'
import { isEditableTarget } from '../logic/input'

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

    useEffect(() => {
        const layout = layoutRef.current
        const resizeCanvas = () => {
            setViewportSize([innerWidth, innerHeight])
            setStageSize([
                Math.max(1, innerWidth / 100 * (100 - layout.mainset - layout.eventset)),
                Math.max(1, innerHeight / 100 * (100 - layout.underbar)),
            ])
        }
        const keydown = (event:KeyboardEvent) => {
            if (event.altKey && !isEditableTarget(event.target)) event.preventDefault()
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
        const wheel = (event:WheelEvent) => {
            if (!event.altKey) return
            event.preventDefault()
            zoomRef.current -= zoomRef.current / 8 * (event.deltaY / 100)
            zoomRef.current = clamp(zoomRef.current, 100, 800)
            setZoom(zoomRef.current)
        }
        const contextmenu = (event:Event) => event.preventDefault()

        window.addEventListener('resize', resizeCanvas)
        document.addEventListener('wheel', wheel, { passive:false })
        document.addEventListener('contextmenu', contextmenu)
        document.addEventListener('mousemove', mousemove)
        document.addEventListener('mousedown', mousedown)
        document.addEventListener('mouseup', mouseup)
        document.addEventListener('keydown', keydown)
        resizeCanvas()

        return () => {
            window.removeEventListener('resize', resizeCanvas)
            document.removeEventListener('wheel', wheel)
            document.removeEventListener('contextmenu', contextmenu)
            document.removeEventListener('mousemove', mousemove)
            document.removeEventListener('mousedown', mousedown)
            document.removeEventListener('mouseup', mouseup)
            document.removeEventListener('keydown', keydown)
            document.body.style.cursor = 'unset'
        }
    }, [])

    const resetZoom = useCallback(() => {
        zoomRef.current = 100
        setZoom(100)
    }, [])

    return {
        underbarLine,
        mainsetLine,
        eventsetLine,
        objLine,
        viewportSize,
        stageSize,
        zoom,
        zoomRef,
        layoutRef,
        resetZoom,
    }
}
