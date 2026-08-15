import {
    useCallback,
    useEffect,
    useEffectEvent,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react"
import { BattleGauge } from '../components/BattleGauge'
import { useRuntimeRoute } from '../components/RuntimeStatus'
import { enableFilters, strengthFilters } from "../data/utils"
import { obj, event, level, objEvent, eventProps, objEventProps, filter, filterType, eventValue, wiggleAxis } from "../data/types"
import { BattleRenderer } from '../renderers/BattleRenderer'
import {
    createSkippedJudgementBaseline,
    enqueuePendingHit,
    isAudioActivelyPlaying,
    prepareNotes,
    timelineStampFromAudio,
    type JudgementState,
} from "../logic/battleDomain"
import {
    advanceBattleFrame,
    createBattleGaugeState,
    type BattleGaugeState,
} from '../logic/battleGauge'
import { createGameplayKeyLatch } from '../logic/battleInput'
import { clearEditorSeekEpoch, pauseAudioForLevelImport, seekAudioToLevelStart } from '../logic/editorAudio'
import { isEditableTarget } from '../logic/input'
import { audioTimeToTimeline, buildGridLines, clampTimeline } from "../logic/timing"
import { useAnimationFrame } from "../hooks/useAnimationFrame"
import { useRuntimeMedia } from '../hooks/useRuntimeMedia'
import { parseLevelJson } from '../logic/contentValidation'
import {
    clamp,
    buildTimelineRulerMarks,
    consumeWheelRows,
    formatTimelineTime,
    isTimelineMarkerVisible,
    timelinePixelAt,
    timelineScrollMetrics,
    timelineStampAtPixel,
    zoomTimelineAtPixel,
} from '../logic/editorLayout'
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
    timelineNodeStamp,
    uniqueTimelineNodes,
    type TimelineNodeContent,
    type TimelineNodeRef,
} from '../logic/editorTimelineNodes'
import { wiggleDurationRate, wiggleDurationSeconds } from '../logic/wiggle'
import { TimelineLane, type TimelineLaneMarker } from './TimelineLane'
import { useEditorLayout } from './useEditorLayout'

type ObjectEditorValue = string | number | boolean | [0|1, number]
type EventEditorValue = event[eventProps]
type ObjectEventEditorValue = objEvent[objEventProps]
type EventClipboard = { scope:'main', value:event } | { scope:'object', value:objEvent }
type EditorPlaytestStatus = 'idle' | 'running' | 'paused' | 'failed' | 'cleared'
type TimelineNodeDrag = {
    pointerId:number
    startClientX:number
    baseline:TimelineNodeContent
    selection:TimelineNodeRef[]
    target:TimelineNodeRef
    delta:number
    moved:boolean
    collapseSelectionOnClick:boolean
    captureElement:HTMLElement
}
type TimelineMarquee = {
    pointerId:number
    startClientX:number
    startClientY:number
    currentClientX:number
    currentClientY:number
    baseSelection:TimelineNodeRef[]
    additive:boolean
    captureElement:HTMLElement
}

const TIMELINE_LANE_HEIGHT = 30

const timelineEventMeta:Record<string, { shortLabel:string, name:string }> = {
    bgcolor:{ shortLabel:'BG', name:'background color' },
    filter:{ shortLabel:'FX', name:'filter' },
    wiggle:{ shortLabel:'WG', name:'wiggle' },
    position:{ shortLabel:'XY', name:'position' },
    rotate:{ shortLabel:'RT', name:'rotation' },
    scale:{ shortLabel:'SC', name:'scale' },
    opacity:{ shortLabel:'OP', name:'opacity' },
    anchor:{ shortLabel:'AN', name:'anchor' },
    bpm:{ shortLabel:'BP', name:'BPM' },
    ease:{ shortLabel:'EZ', name:'easing' },
    visible:{ shortLabel:'VI', name:'visibility' },
    change:{ shortLabel:'IM', name:'image' },
    mcolor:{ shortLabel:'MC', name:'main color' },
    jcolor:{ shortLabel:'JC', name:'judge color' },
    ncolor:{ shortLabel:'NC', name:'note color' },
    drawer:{ shortLabel:'DR', name:'note draw mode' },
    shape:{ shortLabel:'SH', name:'note shape' },
    line:{ shortLabel:'LN', name:'main line width' },
    nline:{ shortLabel:'NL', name:'note line width' },
}

function eventMarker(
    node:TimelineNodeRef,
    stamp:number,
    pixel:number,
    eventType:string,
    scope:string,
):TimelineLaneMarker {
    const meta = timelineEventMeta[eventType] ?? { shortLabel:'EV', name:eventType }
    return {
        node,
        stamp,
        pixel,
        kind:'event',
        eventType,
        shortLabel:meta.shortLabel,
        label:`${scope} ${meta.name} event at ${stamp.toFixed(3)} seconds`,
    }
}

function inputEventValue(value:eventValue | undefined):string | number {
    return typeof value === 'string' || typeof value === 'number' ? value : ''
}

function vectorEventValue(value:eventValue | undefined):[number, number] {
    return Array.isArray(value) ? value : [0, 0]
}

function booleanEventValue(value:eventValue | undefined):boolean {
    return typeof value === 'boolean' ? value : Boolean(value)
}

const defaultFilters:filter = {blur:0, dot:0, motionBlur:0, bloom:0, godray:0, convolution:0, glitch:0, grayscale:0, noise:0, pixelate:0, rgbsplit:0}

function insertByStamp<T extends { stamp:number }>(items:T[], item:T) {
    const index = items.findIndex(current => current.stamp > item.stamp)
    return index === -1
        ? [...items, item]
        : [...items.slice(0, index), item, ...items.slice(index)]
}

export default function Page(){
    const {
        underbarLine,
        mainsetLine,
        eventsetLine,
        objLine,
        viewportSize:condset,
        stageSize,
        zoom,
        zoomRef,
        setEditorZoom,
        layoutRef,
        resetZoom,
    } = useEditorLayout()
    const [rowScroll, setRowScroll] = useState<number>(0)
    const [colScroll, setColScroll] = useState<number>(0)
    const [importError, setImportError] = useState<string | null>(null)

    // default settings
    const [bpm, setBpm] = useState<number>(100)
    const [offset, setOffset] = useState<number>(0)
    const [song, setSong] = useState<string>('')
    const [BackgroundColor, setBackgroundColor] = useState<string>('#000000')
    const [volume, setVolume] = useState<number>(100)
    const [endpoint, setEndpoint] = useState<number>(90)
    const [events, setEvents] = useState<event[]>([])
    const [objs, setObjs] = useState<obj[]>([])
    const [position, setPosition] = useState<[number, number]>([0, 0])
    const [rotate, setRotate] = useState<number>(0)
    const [scale, setScale] = useState<number>(1)
    const [filters, setFilters] = useState<filter>(defaultFilters)
    
    // env settings
    const [grid, setGrid] = useState<number>(4)
    const [gridOffset, setGridOffset] = useState<number>(0)
    const [chartOffset, setChartOffset] = useState<number>(0)
    const [playing, setPlaying] = useState<boolean>(false)
    const [playtestStatus, setPlaytestStatus] = useState<EditorPlaytestStatus>('idle')
    const [playtestStart, setPlaytestStart] = useState(0)
    const [gauge, setGauge] = useState<BattleGaugeState>(createBattleGaugeState)
    const [timeline, setTimeline] = useState<number>(0)
    const gridLine = useMemo(() => buildGridLines({ bpm, divisions:grid, endpoint, offset:gridOffset }), [bpm, endpoint, grid, gridOffset])
    const [sel, setSel] = useState<'chart'|'sprite'>('chart')
    const [focusEvent, setFocusEvent] = useState<[number, number]>([-1, 0]) // 0 = main | other = obj's idx, index
    const [focusNote, setFocusNote] = useState<[number, number]>([-1, 0]) // obj's idx, index
    const [focusObj, setFocusObj] = useState<number>(0)
    const [focusing, setFocusing] = useState<number>(0) // 0 = obj, 1 = event, 2 = note
    const [timelineSelection, setTimelineSelection] = useState<TimelineNodeRef[]>([])
    const [timelineNodesDragging, setTimelineNodesDragging] = useState(false)
    const [timelineMarquee, setTimelineMarquee] = useState<TimelineMarquee | null>(null)
    const [activeTimelineStack, setActiveTimelineStack] = useState<string | null>(null)
    const [evClipboard, setEvClipboard] = useState<EventClipboard>()
    const {
        mediaRef:audioRef,
        elementRef:audioElementRef,
        complete:completeAudio,
        fail:failAudio,
    } = useRuntimeMedia<HTMLAudioElement>(song, 'Editor audio failed to decode.', Boolean(song))
    const fileInputRef = useRef<HTMLInputElement>(null)
    const timelineRef = useRef(0)
    const timelineElementRef = useRef<HTMLDivElement>(null)
    const controlsRef = useRef<HTMLDivElement>(null)
    const eventsElementRef = useRef<HTMLDivElement>(null)
    const objectsRef = useRef<HTMLDivElement>(null)
    const scrollbarTrackRef = useRef<HTMLDivElement>(null)
    const scrollbarThumbRef = useRef<HTMLDivElement>(null)
    const colWheelRemainderRef = useRef(0)
    const [timelineWidth, setTimelineWidth] = useState(0)
    const pendingHitsRef = useRef<number[]>([])
    const keyLatch = useMemo(() => createGameplayKeyLatch(), [])
    const judgementsRef = useRef<JudgementState>({})
    const [judgements, setJudgements] = useState<JudgementState>({})
    const gaugeRef = useRef(createBattleGaugeState())
    const sourceEpochRef = useRef(0)
    const timelineNodeDragRef = useRef<TimelineNodeDrag | null>(null)
    const timelineMarqueeRef = useRef<TimelineMarquee | null>(null)
    const clearSeekEpoch = useCallback(() => {
        clearEditorSeekEpoch(pendingHitsRef, judgementsRef, setJudgements)
    }, [])
    const renderData = useMemo(() => ({
        events,
        objs,
        backgroundColor: BackgroundColor,
        position,
        rotate,
        scale,
        filters,
    }), [BackgroundColor, events, filters, objs, position, rotate, scale])
    const preparedNotes = useMemo(() => prepareNotes(objs), [objs])
    const chartTopologyKey = useMemo(() => objs.map(object => object.type === 'chart'
        ? `chart:${object.notes?.map(note => note.stamp).join(',') ?? ''}`
        : object.type
    ).join('|'), [objs])
    const resetPlaytestState = useCallback(() => {
        clearSeekEpoch()
        const nextGauge = createBattleGaugeState()
        gaugeRef.current = nextGauge
        setGauge(nextGauge)
        setPlaytestStatus('idle')
    }, [clearSeekEpoch])
    const beginPlaytestEpoch = useCallback((start:number) => {
        const baseline = createSkippedJudgementBaseline(preparedNotes, start)
        pendingHitsRef.current = []
        judgementsRef.current = baseline
        setJudgements(baseline)
        const nextGauge = createBattleGaugeState()
        gaugeRef.current = nextGauge
        setGauge(nextGauge)
        setPlaytestStart(start)
    }, [preparedNotes])
    const timelineViewportWidth = timelineWidth || Math.max(1, condset[0] / 100 * (100 - objLine))
    const timelinePixel = (stamp:number) => timelinePixelAt(stamp, endpoint, timelineViewportWidth, zoom, rowScroll)
    const selectedTimelineNodeKeys = useMemo(
        () => new Set(timelineSelection.map(timelineNodeKey)),
        [timelineSelection],
    )
    const timelineSelectionSummary = useMemo(() => {
        const stamps = timelineSelection
            .map(node => timelineNodeStamp({ events, objects:objs }, node))
            .filter((stamp):stamp is number => stamp !== undefined)
        if (stamps.length === 0) return
        return {
            start:Math.min(...stamps),
            end:Math.max(...stamps),
            active:stamps.at(-1)!,
        }
    }, [events, objs, timelineSelection])

    const focusTimelineNode = (node:TimelineNodeRef | undefined) => {
        if (!node) {
            setFocusEvent([-1, 0])
            setFocusNote([-1, 0])
            setFocusing(0)
        } else if (node.kind === 'main-event') {
            setFocusEvent([0, node.index])
            setFocusNote([-1, 0])
            setFocusing(1)
        } else if (node.kind === 'object-event') {
            setFocusEvent([node.objectIndex + 1, node.index])
            setFocusNote([-1, 0])
            setFocusing(1)
        } else {
            setFocusEvent([-1, 0])
            setFocusNote([node.objectIndex, node.index])
            setFocusing(2)
        }
    }

    const applyTimelineSelection = (selection:TimelineNodeRef[]) => {
        const unique = uniqueTimelineNodes(selection)
        setTimelineSelection(unique)
        focusTimelineNode(unique.at(-1))
    }

    const clearTimelineSelection = () => {
        applyTimelineSelection([])
        setActiveTimelineStack(null)
    }
    useRuntimeRoute('battle-editor')

    useLayoutEffect(() => {
        const timelineElement = timelineElementRef.current
        if (!timelineElement) return

        const updateWidth = () => setTimelineWidth(timelineElement.getBoundingClientRect().width)
        const observer = new ResizeObserver(updateWidth)
        observer.observe(timelineElement)
        updateWidth()
        return () => observer.disconnect()
    }, [])
    
    
    // new 눌렀을때 리셋
    const reset = () => {
        pauseAudioForLevelImport(audioRef.current)
        setGrid(4)
        setBpm(100)
        setSong("")
        setOffset(0)
        setBackgroundColor("#000000")
        setVolume(100)
        setEndpoint(90)
        setPlaying(false)
        resetZoom()
        setRowScroll(0)
        setColScroll(0)
        colWheelRemainderRef.current = 0
        timelineRef.current = 0
        resetPlaytestState()
        setEvents([])
        setObjs([])
        setFilters(defaultFilters)
        setEvClipboard(undefined)
        clearTimelineSelection()
        setFocusObj(0)
        setImportError(null)
        v_setTimeline(0)
    }

    const openLevel = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
            fileInputRef.current.click()
        }
    }

    const handleLevelFile = async (change:ChangeEvent<HTMLInputElement>) => {
        const selectedFile = change.target.files?.[0]
        if (!selectedFile) return
        try {
            const loadedLevel = parseLevelJson(await selectedFile.text())
            pauseAudioForLevelImport(audioRef.current)
            setPlaying(false)
            resetPlaytestState()
            setBpm(loadedLevel.bpm)
            setOffset(loadedLevel.offset)
            setSong(loadedLevel.song)
            setBackgroundColor(loadedLevel.backgroundColor)
            setVolume(loadedLevel.volume)
            setEndpoint(loadedLevel.endpoint)
            setObjs(loadedLevel.objs)
            setEvents(loadedLevel.events)
            setPosition(loadedLevel.position)
            setRotate(loadedLevel.rotate)
            setScale(loadedLevel.scale)
            setFilters(loadedLevel.filters ?? defaultFilters)
            clearTimelineSelection()
            setFocusObj(0)
            setEvClipboard(undefined)
            setRowScroll(0)
            setColScroll(0)
            colWheelRemainderRef.current = 0
            timelineRef.current = 0
            setTimeline(0)
            setImportError(null)
        } catch (error) {
            console.warn('Unable to open level JSON.', error)
            setImportError(error instanceof Error ? error.message : 'Unable to open level JSON.')
        }
    }

    const exportLevel = () => {
        const _a = document.createElement('a') as HTMLAnchorElement
        const _obj:level = {bpm, events, endpoint, objs, offset, song, volume, backgroundColor:BackgroundColor, position, rotate, scale, filters}
        _a.download = 'level.json'
        const _blob = new Blob([JSON.stringify(_obj)], {type:'application/json'})
        _a.href = URL.createObjectURL(_blob)
        _a.click()
        URL.revokeObjectURL(_a.href)
    }

    async function startPlaytestAt(start:number) {
        const audio = audioRef.current
        if (!audio || !song) return
        const nextStart = clampTimeline(start >= endpoint ? 0 : start, endpoint)
        beginPlaytestEpoch(nextStart)
        timelineRef.current = nextStart
        setTimeline(nextStart)
        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            audio.currentTime = Math.max(0, nextStart + offset)
        }
        try {
            await audio.play()
            setPlaying(true)
            setPlaytestStatus('running')
        } catch (error) {
            console.error('Unable to start editor playtest.', error)
            setPlaying(false)
            setPlaytestStatus('paused')
        }
    }

    async function playLevel (){
        const audio = audioRef.current
        if (!audio || !song || (playtestStatus === 'running' && !playing)) return

        if (playing) {
            audio.pause()
            setPlaying(false)
            setPlaytestStatus('paused')
            return
        }

        if (playtestStatus === 'paused') {
            try {
                await audio.play()
                setPlaying(true)
                setPlaytestStatus('running')
            } catch (error) {
                console.error('Unable to resume editor playtest.', error)
            }
            return
        }

        const start = playtestStatus === 'failed' || playtestStatus === 'cleared'
            ? playtestStart
            : timelineRef.current
        await startPlaytestAt(start)
    }

    const returnToEditing = () => {
        audioRef.current?.pause()
        setPlaying(false)
        resetPlaytestState()
    }

    const v_setTimeline = (e:number) => {
        const nextTimeline = clampTimeline(e, endpoint)
        audioRef.current?.pause()
        setPlaying(false)
        resetPlaytestState()
        timelineRef.current = nextTimeline
        if (audioRef.current && song) {
            audioRef.current.currentTime = nextTimeline + offset
        }
        setTimeline(nextTimeline)
    }

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return
        if (!song) return
        resetPlaytestState()
        const sourceEpoch = sourceEpochRef.current + 1
        sourceEpochRef.current = sourceEpoch
        const expectedSource = new URL(song, window.location.href).href
        const seekToImportedOffset = () => {
            if (sourceEpochRef.current !== sourceEpoch || audio.currentSrc !== expectedSource) return
            if (!seekAudioToLevelStart(audio, offset)) return
            timelineRef.current = 0
            setTimeline(0)
        }
        if (audio.currentSrc === expectedSource && audio.readyState >= 1) {
            seekToImportedOffset()
            return () => {
                if (sourceEpochRef.current === sourceEpoch) sourceEpochRef.current += 1
            }
        }
        audio.addEventListener('loadedmetadata', seekToImportedOffset, { once:true })
        return () => {
            audio.removeEventListener('loadedmetadata', seekToImportedOffset)
            if (sourceEpochRef.current === sourceEpoch) sourceEpochRef.current += 1
        }
    }, [audioRef, offset, resetPlaytestState, song])

    useAnimationFrame(() => {
        const audio = audioRef.current
        if (!audio) return

        const currentTimeline = clampTimeline(audioTimeToTimeline(audio.currentTime, offset), endpoint)
        timelineRef.current = currentTimeline
        const result = advanceBattleFrame(
            preparedNotes,
            pendingHitsRef.current,
            currentTimeline,
            judgementsRef.current,
            gaugeRef.current,
        )
        pendingHitsRef.current = result.pendingHits
        if (result.judgements !== judgementsRef.current) {
            judgementsRef.current = result.judgements
            setJudgements(result.judgements)
        }
        if (result.gauge !== gaugeRef.current) {
            gaugeRef.current = result.gauge
            setGauge(result.gauge)
        }
        setTimeline(currentTimeline)

        if (result.gauge.failed) {
            audio.pause()
            setPlaying(false)
            setPlaytestStatus('failed')
            return
        }

        if(currentTimeline >= endpoint){
            audio.pause()
            timelineRef.current = endpoint
            setTimeline(endpoint)
            setPlaying(false)
            setPlaytestStatus('cleared')
        }
    }, playing)

    useEffect(() => {
        audioRef.current?.pause()
        setPlaying(false)
        resetPlaytestState()
    }, [audioRef, chartTopologyKey, resetPlaytestState])

    const timelineNodePointerDown = (pointer:ReactPointerEvent<HTMLElement>, node:TimelineNodeRef) => {
        if (playing || pointer.button !== 0) return
        pointer.preventDefault()
        pointer.stopPropagation()

        const key = timelineNodeKey(node)
        const isSelected = selectedTimelineNodeKeys.has(key)
        let nextSelection:TimelineNodeRef[]
        if (pointer.metaKey || pointer.ctrlKey) {
            nextSelection = selectTimelineNode(timelineSelection, node, 'toggle')
        } else if (pointer.shiftKey) {
            nextSelection = selectTimelineNode(timelineSelection, node, 'range')
        } else {
            nextSelection = isSelected ? timelineSelection : selectTimelineNode(timelineSelection, node, 'replace')
        }
        applyTimelineSelection(nextSelection)
        if (!nextSelection.some(selected => timelineNodeKey(selected) === key)) return

        pointer.currentTarget.setPointerCapture(pointer.pointerId)
        timelineNodeDragRef.current = {
            pointerId:pointer.pointerId,
            startClientX:pointer.clientX,
            baseline:{ events, objects:objs },
            selection:nextSelection,
            target:node,
            delta:0,
            moved:false,
            collapseSelectionOnClick:!(pointer.metaKey || pointer.ctrlKey || pointer.shiftKey)
                && isSelected
                && timelineSelection.length > 1,
            captureElement:pointer.currentTarget,
        }
    }

    const timelineNodeKeyDown = (key:ReactKeyboardEvent<HTMLElement>, node:TimelineNodeRef) => {
        if (playing || (key.code !== 'Enter' && key.code !== 'Space')) return
        key.preventDefault()
        key.stopPropagation()
        const mode = key.metaKey || key.ctrlKey ? 'toggle' : key.shiftKey ? 'range' : 'replace'
        applyTimelineSelection(selectTimelineNode(timelineSelection, node, mode))
    }

    const timelineNodePointerMove = useEffectEvent((pointer:PointerEvent) => {
        const drag = timelineNodeDragRef.current
        if (!drag || pointer.pointerId !== drag.pointerId) return
        const movement = pointer.clientX - drag.startClientX
        if (!drag.moved && Math.abs(movement) < 3) return
        pointer.preventDefault()
        drag.moved = true
        setTimelineNodesDragging(true)

        const timelineElement = timelineElementRef.current
        if (!timelineElement || endpoint <= 0) return
        const contentWidth = timelineScrollMetrics(
            timelineElement.getBoundingClientRect().width,
            zoomRef.current,
            rowScroll,
        ).contentWidth
        if (contentWidth <= 0) return

        let requestedDelta = endpoint * movement / contentWidth
        if (pointer.shiftKey) {
            const targetStamp = timelineNodeStamp(drag.baseline, drag.target)
            const gridStep = bpm > 0 && grid > 0 ? 60 / bpm / grid : 0
            if (targetStamp !== undefined && gridStep > 0) {
                requestedDelta = snapTimelineStamp(
                    targetStamp + requestedDelta,
                    gridStep,
                    gridOffset,
                    endpoint,
                ) - targetStamp
            }
        }

        const moved = moveTimelineNodes(drag.baseline, drag.selection, requestedDelta, endpoint)
        drag.delta = moved.delta
        setEvents(moved.events)
        setObjs(moved.objects)
    })

    const finishTimelineNodeDrag = useEffectEvent((pointer:PointerEvent) => {
        const drag = timelineNodeDragRef.current
        if (!drag || pointer.pointerId !== drag.pointerId) return
        if (drag.moved) {
            const moved = moveTimelineNodes(drag.baseline, drag.selection, drag.delta, endpoint)
            const sorted = sortTimelineNodes(moved, drag.selection)
            setEvents(sorted.events)
            setObjs(sorted.objects)
            applyTimelineSelection(sorted.selection)
        } else if (drag.collapseSelectionOnClick) {
            applyTimelineSelection([drag.target])
        }
        if (drag.captureElement.hasPointerCapture(drag.pointerId)) {
            drag.captureElement.releasePointerCapture(drag.pointerId)
        }
        timelineNodeDragRef.current = null
        setTimelineNodesDragging(false)
    })

    const cancelTimelineNodeDrag = useEffectEvent(() => {
        const drag = timelineNodeDragRef.current
        if (!drag) return
        if (drag.moved) {
            setEvents(drag.baseline.events)
            setObjs(drag.baseline.objects)
            applyTimelineSelection(drag.selection)
        }
        if (drag.captureElement.hasPointerCapture(drag.pointerId)) {
            drag.captureElement.releasePointerCapture(drag.pointerId)
        }
        timelineNodeDragRef.current = null
        setTimelineNodesDragging(false)
    })

    useEffect(() => {
        document.addEventListener('pointermove', timelineNodePointerMove, { passive:false })
        document.addEventListener('pointerup', finishTimelineNodeDrag)
        document.addEventListener('pointercancel', cancelTimelineNodeDrag)
        window.addEventListener('blur', cancelTimelineNodeDrag)
        return () => {
            document.removeEventListener('pointermove', timelineNodePointerMove)
            document.removeEventListener('pointerup', finishTimelineNodeDrag)
            document.removeEventListener('pointercancel', cancelTimelineNodeDrag)
            window.removeEventListener('blur', cancelTimelineNodeDrag)
        }
    }, [])

    const timelineMarqueePointerDown = (pointer:ReactPointerEvent<HTMLDivElement>) => {
        if (playing || pointer.button !== 0) return
        const target = pointer.target as HTMLElement
        if (target.closest('[data-timeline-node], [data-timeline-stack-nodes]')) return
        pointer.preventDefault()
        setActiveTimelineStack(null)
        const next:TimelineMarquee = {
            pointerId:pointer.pointerId,
            startClientX:pointer.clientX,
            startClientY:pointer.clientY,
            currentClientX:pointer.clientX,
            currentClientY:pointer.clientY,
            baseSelection:timelineSelection,
            additive:pointer.metaKey || pointer.ctrlKey || pointer.shiftKey,
            captureElement:pointer.currentTarget,
        }
        pointer.currentTarget.setPointerCapture(pointer.pointerId)
        timelineMarqueeRef.current = next
        setTimelineMarquee(next)
    }

    const timelineMarqueePointerMove = (pointer:ReactPointerEvent<HTMLDivElement>) => {
        const marquee = timelineMarqueeRef.current
        if (!marquee || pointer.pointerId !== marquee.pointerId) return
        pointer.preventDefault()
        const next = {
            ...marquee,
            currentClientX:pointer.clientX,
            currentClientY:pointer.clientY,
        }
        timelineMarqueeRef.current = next
        setTimelineMarquee(next)
    }

    const finishTimelineMarquee = (pointer:ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
        const marquee = timelineMarqueeRef.current
        if (!marquee || pointer.pointerId !== marquee.pointerId) return
        const moved = Math.hypot(
            pointer.clientX - marquee.startClientX,
            pointer.clientY - marquee.startClientY,
        ) >= 4
        if (!cancelled && moved) {
            const left = Math.min(marquee.startClientX, pointer.clientX)
            const right = Math.max(marquee.startClientX, pointer.clientX)
            const top = Math.min(marquee.startClientY, pointer.clientY)
            const bottom = Math.max(marquee.startClientY, pointer.clientY)
            const selected = Array.from(
                eventsElementRef.current?.querySelectorAll<HTMLElement>('[data-timeline-node], [data-timeline-stack-nodes]') ?? [],
            ).flatMap(element => {
                const rect = element.getBoundingClientRect()
                const centerX = rect.left + rect.width / 2
                const centerY = rect.top + rect.height / 2
                if (centerX < left || centerX > right || centerY < top || centerY > bottom) return []
                const node = parseTimelineNodeKey(element.dataset.timelineNode ?? '')
                if (node) return [node]
                return (element.dataset.timelineStackNodes ?? '')
                    .split('|')
                    .flatMap(value => {
                        const stackedNode = parseTimelineNodeKey(value)
                        return stackedNode ? [stackedNode] : []
                    })
            })
            applyTimelineSelection(marquee.additive
                ? uniqueTimelineNodes([...marquee.baseSelection, ...selected])
                : selected
            )
        } else if (!cancelled && !marquee.additive) {
            clearTimelineSelection()
        }
        if (marquee.captureElement.hasPointerCapture(marquee.pointerId)) {
            marquee.captureElement.releasePointerCapture(marquee.pointerId)
        }
        timelineMarqueeRef.current = null
        setTimelineMarquee(null)
    }

    const timelineMouseMove = useEffectEvent((e:MouseEvent) => {
        const layout = layoutRef.current
        if(!layout.controlsDragging) return
        const controls = controlsRef.current
        if (!controls) return

        const rect = controls.getBoundingClientRect()
        let nextTimeline = timelineStampAtPixel(
            e.clientX - rect.left,
            endpoint,
            rect.width,
            zoomRef.current,
            rowScroll,
        )
        if(e.shiftKey && gridLine.length > 1){
            const exponent = 5-Math.round(zoom/100)
            const factor = 2**(exponent < 1 ? 1 : exponent)
            const gap = (gridLine[1] - gridLine[0]) * factor
            if (gap > 0) {
                nextTimeline = Math.round((nextTimeline-(gridOffset%gap)) / gap) * gap + (gridOffset%gap)
                nextTimeline = Math.max(nextTimeline, gridOffset)
            }
        }
        v_setTimeline(nextTimeline)
    })

    const scrollbarMouseMove = useEffectEvent((e:MouseEvent) => {
        const layout = layoutRef.current
        if (!layout.scrollbarDragging) return
        const track = scrollbarTrackRef.current
        if (!track) return
        const rect = track.getBoundingClientRect()
        const metrics = timelineScrollMetrics(rect.width, zoomRef.current, rowScroll)
        if (metrics.maxScroll === 0 || metrics.thumbTravel === 0) {
            setRowScroll(0)
            return
        }
        const thumbLeft = clamp(
            e.clientX - rect.left - layout.scrollbarGrabOffset,
            0,
            metrics.thumbTravel,
        )
        setRowScroll(-(thumbLeft / metrics.thumbTravel) * metrics.maxScroll)
    })

    const timelineKeyDown = useEffectEvent((e:KeyboardEvent) => {
        if (isEditableTarget(e.target)) return
        if (playing) return

        const isNumlock = e.getModifierState('NumLock')
        if(e.code == 'Space'){
            e.preventDefault()
            void playLevel()
        } else if(e.code == 'Home' || (e.code == 'Numpad7' && !isNumlock)){
            v_setTimeline(0)
        } else if(e.code == 'End' || (e.code == 'Numpad1' && !isNumlock)){
            v_setTimeline(endpoint)
        } else if(e.code == 'Backquote'){
            setRowScroll(0)
        }
    })

    useEffect(() => {
        const controls = controlsRef.current
        const scrollbar = scrollbarThumbRef.current
        const layout = layoutRef.current

        const mouseup = () => {
            layout.controlsDragging = false
            layout.scrollbarDragging = false
        }
        const controlsMouseDown = (e:MouseEvent) => {
            if(!layout.dragging){
                layout.controlsDragging = true
                timelineMouseMove(e)
            }
        }
        const scrollbarMouseDown = (e:MouseEvent) => {
            if(!layout.dragging){
                layout.scrollbarDragging = true
                layout.scrollbarGrabOffset = e.clientX - scrollbar!.getBoundingClientRect().left
                scrollbarMouseMove(e)
            }
        }

        controls?.addEventListener('mousedown', controlsMouseDown)
        scrollbar?.addEventListener('mousedown', scrollbarMouseDown)
        document.addEventListener('mouseup', mouseup)
        document.addEventListener('mousemove', timelineMouseMove)
        document.addEventListener('mousemove', scrollbarMouseMove)
        document.addEventListener('keydown', timelineKeyDown)
        return () => {
            controls?.removeEventListener('mousedown', controlsMouseDown)
            scrollbar?.removeEventListener('mousedown', scrollbarMouseDown)
            document.removeEventListener('mouseup', mouseup)
            document.removeEventListener('mousemove', timelineMouseMove)
            document.removeEventListener('mousemove', scrollbarMouseMove)
            document.removeEventListener('keydown', timelineKeyDown)
        }
    }, [layoutRef])

    // state volume변경시 실제 오디오 볼륨을 변경하는 코드
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume/100
    }, [audioRef, volume])

    // 휠버튼으로 타임라인 이동하는 코드
    useEffect(() => {
        const timelineElement = timelineElementRef.current
        if (!timelineElement) return
        const activeTimelineElement = timelineElement
        // 휠 이벤트
        function wheelev(e:WheelEvent){
            e.preventDefault()
            const rect = activeTimelineElement.getBoundingClientRect()
            if (e.altKey) {
                const requestedZoom = zoomRef.current - zoomRef.current / 8 * (e.deltaY / 100)
                const anchored = zoomTimelineAtPixel(
                    rect.width,
                    endpoint,
                    zoomRef.current,
                    rowScroll,
                    e.clientX - rect.left,
                    requestedZoom,
                )
                setEditorZoom(anchored.zoom)
                setRowScroll(anchored.scroll)
                setActiveTimelineStack(null)
                return
            }
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
            setRowScroll(current => timelineScrollMetrics(rect.width, zoomRef.current, current - delta).scroll)
            setActiveTimelineStack(null)
        }
        activeTimelineElement.addEventListener('wheel', wheelev, { passive:false })
        return () => {
            activeTimelineElement.removeEventListener('wheel', wheelev)
        }
    }, [endpoint, rowScroll, setEditorZoom, zoomRef])

    // 휠버튼으로 오브젝트 스크롤 이동하는 코드
    useEffect(() => {
        const objectsElement = objectsRef.current
        if (!objectsElement) return
        const activeObjectsElement = objectsElement
        // 휠 이벤트
        function wheelev(e:WheelEvent){
            if(!e.altKey){
                e.preventDefault()
                const pageSize = Math.max(activeObjectsElement.clientHeight, 1)
                const delta = e.deltaMode === 1
                    ? e.deltaY * 16
                    : e.deltaMode === 2
                        ? e.deltaY * pageSize
                        : e.deltaY
                const consumed = consumeWheelRows(colWheelRemainderRef.current, delta)
                colWheelRemainderRef.current = consumed.remainder
                if (consumed.rows !== 0) {
                    setColScroll(current => clamp(current + consumed.rows, 0, objs.length))
                }
            }
        }
        activeObjectsElement.addEventListener('wheel', wheelev, { passive:false })
        return () => {
            activeObjectsElement.removeEventListener('wheel', wheelev)
        }
    }, [objs.length])

    useEffect(() => {
        setRowScroll(current => timelineScrollMetrics(timelineViewportWidth, zoom, current).scroll)
    }, [timelineViewportWidth, zoom])

    useEffect(() => {
        setColScroll(current => clamp(current, 0, objs.length))
    }, [objs.length])

    // 오브젝트 추가 함수
    const addObj = () => {
        const newObject:obj = {anchor:[0, 0],events:[],opacity:1,position:[50, 50],rotate:0,scale:[1, 1],type:sel,visible:true}
        if(sel == "chart"){
            newObject.bpm = bpm
            newObject.ease = 'linear'
            newObject.notes = []
            newObject.mcolor = '#ffffff'
            newObject.jcolor = '#0099ff'
            newObject.ncolor = '#ffffff'
            newObject.drawer = 'stroke'
            newObject.shape = 'arc'
            newObject.line = 3
            newObject.nline = 3
        } else if(sel == "sprite"){
            newObject.src = ''
        }
        setObjs(current => [...current, newObject])
    }

    // 오브젝트 제거 함수
    const remObj = (_i:number) => {
        clearTimelineSelection()
        setObjs(current => current.filter((_, index) => index !== _i))
    }
    
    // 메인 이벤트 추가 함수
    const addEv = (_opt?:event) => {
        clearTimelineSelection()
        const stamp = timelineRef.current
        const newEvent = _opt
            ? { ...structuredClone(_opt), stamp }
            : {
                stamp,
                type:'bgcolor' as const,
                value:'#000000',
                duration:bpm,
                ease:'linear' as const,
                smooth:true,
                speed:6,
                filter:'blur' as const,
                axis:'both' as const,
                seed:1,
                octaves:3,
                falloff:0.5,
            }
        setEvents(current => insertByStamp(current, newEvent))
    }
    
    // 메인 이벤트 제거 함수
    const remEv = (_idx:number) => {
        clearTimelineSelection()
        setEvents(current => current.filter((_, index) => index !== _idx))
    }
    
    // 오브젝트 이벤트 추가 함수
    const addObjEv = (_i:number, _opt?:objEvent) => {
        clearTimelineSelection()
        const stamp = timelineRef.current
        const newEvent:objEvent = _opt
            ? { ...structuredClone(_opt), stamp }
            : {stamp, type:'position', value:[50, 50], ease:'linear', duration:bpm}
        setObjs(current => current.map((object, index) => index === _i
            ? { ...object, events:insertByStamp(object.events, newEvent) }
            : object
        ))
    }

    // 오브젝트 이벤트 제거 함수
    const remObjEv = (_oi:number, _i:number) => {
        clearTimelineSelection()
        setObjs(current => current.map((object, objectIndex) => objectIndex === _oi
            ? { ...object, events:object.events.filter((_, eventIndex) => eventIndex !== _i) }
            : object
        ))
    }
    
    // 차트 노트 추가 함수
    const addChartNote = (_i:number) => {
        clearTimelineSelection()
        const note = {stamp:timelineRef.current, hit:0, judge:'none' as const}
        setObjs(current => current.map((object, index) => index === _i
            ? { ...object, notes:insertByStamp(object.notes ?? [], note) }
            : object
        ))
    }

    // 차트 노트 제거 함수
    const remChartNote = (_oi:number, _i:number) => {
        clearTimelineSelection()
        setObjs(current => current.map((object, objectIndex) => objectIndex === _oi
            ? { ...object, notes:object.notes?.filter((_, noteIndex) => noteIndex !== _i) }
            : object
        ))
    }

    // 오브젝트 속성 설정 함수
    const setObjProperty = (_i:number, _type:keyof obj, _v:ObjectEditorValue) => {
        setObjs(current => current.map((object, index) => {
            if(index !== _i) return object
            if(_type == 'position'){
                const [axis, value] = _v as [0|1, number]
                const position:[number, number] = [...object.position]
                position[axis] = value
                return { ...object, position }
            }
            if(_type == 'scale'){
                const [axis, value] = _v as [0|1, number]
                const scale:[number, number] = [...object.scale]
                scale[axis] = value
                return { ...object, scale }
            }
            if(_type == 'anchor'){
                const [axis, value] = _v as [0|1, number]
                const anchor:[number, number] = [...object.anchor]
                anchor[axis] = value
                return { ...object, anchor }
            }
            return { ...object, [_type]:_v } as obj
        }))
    }

    // 메인 이벤트 설정 함수
    const setEv = (_i:number, _t:eventProps, _v:EventEditorValue):void => {
        const nextEvents = events.map((currentEvent, index) => {
            if(index !== _i) return currentEvent
            const nextEvent:event = { ...currentEvent }
            if(_t == 'type'){
                const eventType = String(_v)
                if(eventType == 'bgcolor') nextEvent.value = '#000000'
                else if(eventType == 'filter') {
                    nextEvent.filter = 'blur'
                    nextEvent.value = 100
                } else if(eventType == 'wiggle') {
                    nextEvent.value = 50
                    nextEvent.speed ??= 6
                    nextEvent.smooth ??= true
                    nextEvent.axis ??= 'both'
                    nextEvent.seed ??= 1
                    nextEvent.octaves ??= 3
                    nextEvent.falloff ??= 0.5
                } else if(eventType == 'position') nextEvent.value = [0, 0]
                else nextEvent.value = 100
            }
            const numericValue = Number(_v)
            Object.assign(nextEvent, { [_t]:_t == 'value' || _t == 'speed' ? Number.isNaN(numericValue) ? _v : numericValue : _v })
            return nextEvent
        })
        if (_t !== 'stamp') {
            setEvents(nextEvents)
            return
        }
        const selection = uniqueTimelineNodes([
            ...timelineSelection,
            { kind:'main-event', index:_i },
        ])
        const sorted = sortTimelineNodes({ events:nextEvents, objects:objs }, selection)
        setEvents(sorted.events)
        applyTimelineSelection(sorted.selection)
    }

    // 오브젝트 이벤트 설정 함수
    const setObjEv = (_oi:number, _i:number, _t:objEventProps, _v:ObjectEventEditorValue):void => {
        const nextObjects = objs.map((object, objectIndex) => {
            if(objectIndex !== _oi) return object
            const objectEvents = object.events.map((currentEvent, eventIndex) => {
                if(eventIndex !== _i) return currentEvent
                const nextEvent:objEvent = { ...currentEvent }
                if(_t == 'type'){
                    const eventType = String(_v)
                    nextEvent.value =
                    ['rotate'].includes(eventType) ? 0 :
                    ['opacity', 'line', 'nline'].includes(eventType) ? 1 :
                    eventType == 'bpm' ? 100 :
                    eventType == 'change' ? '' :
                    ['mcolor', 'jcolor', 'ncolor'].includes(eventType) ? '#ffffff' :
                    ['position', 'scale', 'anchor'].includes(eventType) ? [0, 0] :
                    eventType == 'ease' ? 'linear' :
                    eventType == 'drawer' ? 'stroke' :
                    eventType == 'shape' ? 'arc' :
                    eventType == 'visible'
                }
                Object.assign(nextEvent, { [_t]:_v })
                return nextEvent
            })
            return { ...object, events:objectEvents }
        })
        if (_t !== 'stamp') {
            setObjs(nextObjects)
            return
        }
        const selection = uniqueTimelineNodes([
            ...timelineSelection,
            { kind:'object-event', objectIndex:_oi, index:_i },
        ])
        const sorted = sortTimelineNodes({ events, objects:nextObjects }, selection)
        setObjs(sorted.objects)
        applyTimelineSelection(sorted.selection)
    }

    // 오브젝트 인덱스 설정 함수
    const setObjIdx = (_i:number, _ri:number) => {
        clearTimelineSelection()
        setObjs(current => {
            const selectedObject = current[_i]
            const remaining = current.filter((_, index) => index !== _i)
            return [...remaining.slice(0, _ri), selectedObject, ...remaining.slice(_ri)]
        })
    }

    // 차트 오프셋 전체 변경 함수
    const changeChartOffset = () => {
        setObjs(current => current.map(object => object.type == 'chart'
            ? { ...object, notes:object.notes?.map(note => ({ ...note, stamp:note.stamp + chartOffset })) }
            : object
        ))
    }

    const moveSelectedTimelineNodes = (requestedDelta:number) => {
        const moved = moveTimelineNodes(
            { events, objects:objs },
            timelineSelection,
            requestedDelta,
            endpoint,
        )
        const sorted = sortTimelineNodes(moved, timelineSelection)
        setEvents(sorted.events)
        setObjs(sorted.objects)
        applyTimelineSelection(sorted.selection)
    }

    const deleteSelectedTimelineNodes = () => {
        if (timelineSelection.length === 0) return
        const deleted = deleteTimelineNodes({ events, objects:objs }, timelineSelection)
        setEvents(deleted.events)
        setObjs(deleted.objects)
        clearTimelineSelection()
    }

    const alignSelectedTimelineNodes = () => {
        const aligned = alignTimelineNodes({ events, objects:objs }, timelineSelection)
        setEvents(aligned.events)
        setObjs(aligned.objects)
        applyTimelineSelection(aligned.selection)
        setActiveTimelineStack(null)
    }

    const editorKeyDown = useEffectEvent((e:KeyboardEvent) => {
            if (playing) return
            const target = e.target
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
            const commandModifier = e.ctrlKey || e.metaKey

            if ((e.code === 'Delete' || e.code === 'Backspace') && timelineSelection.length > 0) {
                e.preventDefault()
                deleteSelectedTimelineNodes()
                return
            }
            if (commandModifier && e.code === 'KeyA') {
                e.preventDefault()
                applyTimelineSelection(allTimelineNodes({ events, objects:objs }))
                return
            }
            if (e.code === 'Escape' && activeTimelineStack) {
                e.preventDefault()
                setActiveTimelineStack(null)
                return
            }
            if (e.code === 'Escape' && timelineSelection.length > 0) {
                e.preventDefault()
                clearTimelineSelection()
                return
            }
            if (commandModifier && e.shiftKey && e.code === 'KeyL' && timelineSelection.length > 1) {
                e.preventDefault()
                alignSelectedTimelineNodes()
                return
            }
            if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && timelineSelection.length > 0) {
                e.preventDefault()
                const gridStep = bpm > 0 && grid > 0 ? 60 / bpm / grid : 0.01
                const direction = e.code === 'ArrowLeft' ? -1 : 1
                moveSelectedTimelineNodes(direction * gridStep * (e.shiftKey ? 4 : 1))
                return
            }

            // 옵젝 & 이벤트 삭제
            if(e.code == 'Delete' || e.code == 'Backspace'){
                e.preventDefault()
                if(focusing == 0){
                    if(focusObj != 0){
                        remObj(focusObj-1)
                        if(focusEvent[0]+1 >= focusObj) setFocusEvent([-1, 0])
                        if(focusNote[0] >= focusObj) setFocusNote([-1, 0])
                        setFocusObj(0)
                    }
                } else if(focusing == 1){
                    if(focusEvent[0] == 0){
                        remEv(focusEvent[1])
                        setFocusEvent([-1, 0])
                    } else if(focusEvent[0] > 0){
                        remObjEv(focusEvent[0]-1, focusEvent[1])
                        setFocusEvent([-1, 0])
                    }
                } else if(focusing == 2 && focusNote[0] != -1){
                    remChartNote(...focusNote)
                    setFocusNote([-1, 0])
                }
            // 이벤트 포커징 옮기는 코드
            } else if(e.code == 'ArrowLeft' || e.code == 'ArrowRight'){
                if(focusing == 1 && focusEvent[0] > -1){
                    const _evLen:number = focusEvent[0] == 0 ? events.length : objs[focusEvent[0]-1].events.length
                    let _idx:number = focusEvent[1]
                    _idx += e.code == 'ArrowLeft' ? -1 : 1
                    _idx = _idx < 0 ? 0 : _idx+1 > _evLen ? _evLen-1 : _idx
                    setFocusEvent([focusEvent[0], _idx])
                } else if(focusing == 2 && focusNote[0] > -1){
                    const _ntLen:number = objs[focusNote[0]].notes?.length || 0
                    let _idx:number = focusNote[1]
                    _idx += e.code == 'ArrowLeft' ? -1 : 1
                    _idx = _idx < 0 ? 0 : _idx+1 > _ntLen ? _ntLen-1 : _idx
                    setFocusNote([focusNote[0], _idx])
                }
            // 이벤트 복사, 자르기, 붙여넣기 코드
            } else if((e.code == 'KeyC' || e.code == 'KeyX') && commandModifier){ // 복사 & 자르기
                if(focusEvent[0] != -1){
                    const cb:EventClipboard = focusEvent[0] == 0
                        ? { scope:'main', value:structuredClone(events[focusEvent[1]]) }
                        : { scope:'object', value:structuredClone(objs[focusEvent[0]-1].events[focusEvent[1]]) }
                    if(e.code == 'KeyX') {
                        if (focusEvent[0] == 0) remEv(focusEvent[1])
                        else remObjEv(focusEvent[0]-1, focusEvent[1])
                        setFocusEvent([-1, 0])
                    }
                    setEvClipboard(cb)
                }
            } else if(e.code == 'KeyV' && commandModifier){ // 붙여넣기
                if(evClipboard){
                    if (focusObj == 0 && evClipboard.scope === 'main') addEv(evClipboard.value)
                    else if (focusObj > 0 && evClipboard.scope === 'object') addObjEv(focusObj-1, evClipboard.value)
                }
            } else if(e.code == 'KeyW'){ // 선택된 차트에 노트 추가
                if(focusObj > 0 && objs[focusObj-1].type == 'chart'){
                    addChartNote(focusObj-1)
                }
            } else if(e.code == 'KeyE'){ // 선택된 오브젝트에 이벤트 추가
                if(focusObj == 0){
                    addEv()
                } else if(focusObj > 0){
                    addObjEv(focusObj-1)
                }
            } else if(['ArrowUp', 'ArrowDown'].includes(e.code) && e.shiftKey && focusing == 0 && focusObj != 0){ // 레이어 위치 바꾸기
                const _idx:number = focusObj-1
                const _dir:number = e.code == 'ArrowUp' ? -1 : 1
                if(_idx + _dir < 0 || _idx + _dir >= objs.length) return
                setObjIdx(_idx, _idx + _dir)
                setFocusObj(_idx+ 1 + _dir)
            }
    })

    // 오브젝트 및 이벤트 선택 & 삭제 & 해제 & 수정
    useEffect(() => {
        document.addEventListener('keydown', editorKeyDown)
        return () => {
            document.removeEventListener('keydown', editorKeyDown)
        }
    }, [])

    // 플레이
    useEffect(() => {
        if(playing){
            const keydown = (e:KeyboardEvent) => {
                const audio = audioRef.current
                if(!audio || isEditableTarget(e.target) || !isAudioActivelyPlaying(audio)) return
                if(!keyLatch.press(e)) return
                e.preventDefault()
                const stamp = timelineStampFromAudio(audio, offset)
                pendingHitsRef.current = enqueuePendingHit(pendingHitsRef.current, stamp, stamp)
            }
            const keyup = (e:KeyboardEvent) => keyLatch.release(e.code)
            const clearKeys = () => keyLatch.clear()
            const visibilitychange = () => {
                if (document.visibilityState !== 'visible') clearKeys()
            }
            document.addEventListener('keydown', keydown)
            document.addEventListener('keyup', keyup)
            document.addEventListener('visibilitychange', visibilitychange)
            window.addEventListener('blur', clearKeys)
            return () => {
                document.removeEventListener('keydown', keydown)
                document.removeEventListener('keyup', keyup)
                document.removeEventListener('visibilitychange', visibilitychange)
                window.removeEventListener('blur', clearKeys)
                clearKeys()
            }
        }
    }, [audioRef, keyLatch, offset, playing])

    const changeOffset = (nextOffset:number) => {
        pauseAudioForLevelImport(audioRef.current)
        setPlaying(false)
        resetPlaytestState()
        timelineRef.current = 0
        setTimeline(0)
        setOffset(nextOffset)
    }

    const changeSong = (nextSong:string) => {
        pauseAudioForLevelImport(audioRef.current)
        setPlaying(false)
        resetPlaytestState()
        timelineRef.current = 0
        setTimeline(0)
        setSong(nextSong)
    }

    // easing
    const EaseOpts = () => {
        return <>
            <option value="linear">Linear</option>
            <option value="insine">In-Sine</option>
            <option value="outsine">Out-Sine</option>
            <option value="sine">Sine</option>
            <option value="inquad">In-Quad</option>
            <option value="outquad">Out-Quad</option>
            <option value="quad">Quad</option>
            <option value="incubic">In-Cubic</option>
            <option value="outcubic">Out-Cubic</option>
            <option value="cubic">Cubic</option>
            <option value="inquart">In-Quart</option>
            <option value="outquart">Out-Quart</option>
            <option value="quart">Quart</option>
            <option value="inquint">In-Quint</option>
            <option value="outquint">Out-Quint</option>
            <option value="quint">Quint</option>
            <option value="inexpo">In-Expo</option>
            <option value="outexpo">Out-Expo</option>
            <option value="expo">Expo</option>
            <option value="incirc">In-Circ</option>
            <option value="outcirc">Out-Circ</option>
            <option value="circ">Circ</option>
            <option value="inback">In-Back</option>
            <option value="outback">Out-Back</option>
            <option value="back">Back</option>
        </>
    }

    const scrollbar = timelineScrollMetrics(timelineViewportWidth, zoom, rowScroll)
    const playheadPixel = timelinePixel(timeline)
    const rulerMarks = buildTimelineRulerMarks(timelineViewportWidth, endpoint, zoom, rowScroll)
    const gridDensityExponent = 5 - Math.round(zoom / 100)
    const gridDensityFactor = 2 ** (gridDensityExponent < 1 ? 1 : gridDensityExponent)
    const transportLabel = playing
        ? 'Pause'
        : playtestStatus === 'paused'
            ? 'Resume'
            : playtestStatus === 'failed' || playtestStatus === 'cleared'
                ? 'Replay'
                : playtestStatus === 'running'
                    ? 'Loading…'
                    : 'Playtest'
    const playtestLabel:Record<EditorPlaytestStatus, string> = {
        idle:'Edit preview',
        running:playing ? 'Playtest live' : 'Buffering',
        paused:'Playtest paused',
        failed:'Playtest failed',
        cleared:'Playtest clear',
    }

    // html 코드
    return <div className={`Editor playtest-${playtestStatus}`}>
        {importError && <div className="import-error" role="alert">Level import rejected: {importError}</div>}
        <div style={{height:`${100-underbarLine}%`}} className="workspace">
            <div style={{width:`${mainsetLine}%`}} className="mainset">
                <div>
                    <button onClick={() => reset()}>New</button>
                    <button onClick={() => openLevel()}>Open</button>
                    <button onClick={() => exportLevel()}>Export</button>
                </div>
                <div>
                    <button onClick={() => v_setTimeline(0)}>Home</button>
                    <button
                        className="playlevel"
                        onClick={() => void playLevel()}
                        disabled={!song || (playtestStatus === 'running' && !playing)}
                    >{transportLabel}</button>
                    <button onClick={() => v_setTimeline(endpoint)}>End</button>
                </div>
                <hr />
                {
                    focusObj == 0 ? <>
                        <div><button onClick={() => changeChartOffset()}>Set Chart Offset</button><input type="text" name="" id="" value={chartOffset} onChange={e => setChartOffset(+e.target.value)} /></div>
                        <div>Grid<input type="text" name="" id="" value={grid} onChange={e => setGrid(+e.target.value)} /></div>
                        <div>Grid Offset<input type="text" name="" id="" value={gridOffset} onChange={e => setGridOffset(+e.target.value)} /></div>
                        <div>BPM<input type="text" name="" id="" value={bpm} onChange={e => setBpm(+e.target.value)} /></div>
                        <div>Offsets<input type="text" name="" id="" value={offset} onChange={e => changeOffset(+e.target.value)} /></div>
                        <div>Song<input type="text" name="" id="" value={song} onChange={e => changeSong(e.target.value)} /></div>
                        <div>BackgroundColor<input type="color" name="" id="" value={BackgroundColor} onChange={e => setBackgroundColor(e.target.value)}/></div>
                        <div>Volume<input type="text" name="" id="" value={volume} onChange={e => setVolume(+e.target.value)}/></div>
                        <div>Endpoint<input type="text" name="" id="" value={`${Math.floor(endpoint/60)}:${endpoint%60}`}
                        onChange={e => {
                            const time:number[] = e.target.value.split(':').map(v => +v)
                            setEndpoint((time[0]*60 + time[1]))
                        }}/></div>
                        <div>Position<input type="number" name="" id="" value={position[0]} onChange={e => setPosition([+e.target.value, position[1]])}/>
                        <input type="number" name="" id="" value={position[1]} onChange={e => setPosition([position[0], +e.target.value])}/></div>
                        <div>Rotate<input type="number" name="" id="" value={rotate} onChange={e => setRotate(+e.target.value)}/></div>
                        <div>Scale<input type="number" name="" id="" value={scale} onChange={e => setScale(+e.target.value)}/></div>
                    </>:<>
                        <div>Position<input type="number" name="" id="" value={objs[focusObj-1].position[0]} onChange={e => setObjProperty(focusObj-1, 'position', [0, +e.target.value])}/>
                        <input type="number" name="" id="" value={objs[focusObj-1].position[1]} onChange={e => setObjProperty(focusObj-1, 'position', [1, +e.target.value])}/></div>
                        <div>Rotate<input type="number" name="" id="" value={objs[focusObj-1].rotate} onChange={e => setObjProperty(focusObj-1, 'rotate', +e.target.value)}/></div>
                        <div>Scale<input type="number" name="" id="" value={objs[focusObj-1].scale[0]} onChange={e => setObjProperty(focusObj-1, 'scale', [0, +e.target.value])}/>
                        <input type="number" name="" id="" value={objs[focusObj-1].scale[1]} onChange={e => setObjProperty(focusObj-1, 'scale', [1, +e.target.value])}/></div>
                        <div>Opacity<input type="number" name="" id="" value={objs[focusObj-1].opacity} onChange={e => setObjProperty(focusObj-1, 'opacity', +e.target.value)}/></div>
                        <div>Anchor<input type="number" name="" id="" value={objs[focusObj-1].anchor[0]} onChange={e => setObjProperty(focusObj-1, 'anchor', [0, +e.target.value])}/>
                        <input type="number" name="" id="" value={objs[focusObj-1].anchor[1]} onChange={e => setObjProperty(focusObj-1, 'anchor', [1, +e.target.value])}/></div>
                        <div>Visible<input type="checkbox" name="" id="" checked={objs[focusObj-1].visible} onChange={e => setObjProperty(focusObj-1, 'visible', e.target.checked)}/></div>
                        {objs[focusObj-1].type == 'chart' && <div>BPM<input type="number" name="" id="" value={objs[focusObj-1].bpm}
                        onChange={e => setObjProperty(focusObj-1, 'bpm', +e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Main Color<input type="color" name="" id="" value={objs[focusObj-1].mcolor}
                        onChange={e => setObjProperty(focusObj-1, 'mcolor', e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Judgement Color<input type="color" name="" id="" value={objs[focusObj-1].jcolor}
                        onChange={e => setObjProperty(focusObj-1, 'jcolor', e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Note Color<input type="color" name="" id="" value={objs[focusObj-1].ncolor}
                        onChange={e => setObjProperty(focusObj-1, 'ncolor', e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Note Drawer<select name="" id="" value={objs[focusObj-1].drawer}
                        onChange={e => setObjProperty(focusObj-1, 'drawer', e.target.value)}>
                            <option value="fill">Fill</option>
                            <option value="stroke">Stroke</option>
                        </select></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Note Shape<select name="" id="" value={objs[focusObj-1].shape}
                        onChange={e => setObjProperty(focusObj-1, 'shape', e.target.value)}>
                            <option value="arc">Arc</option>
                            <option value="rect">Rect</option>
                        </select></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Main Line Width<input type="number" name="" id="" value={objs[focusObj-1].line}
                        onChange={e => setObjProperty(focusObj-1, 'line', +e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Note Line Width<input type="number" name="" id="" value={objs[focusObj-1].nline}
                        onChange={e => setObjProperty(focusObj-1, 'nline', +e.target.value)}/></div>}
                        {objs[focusObj-1].type == 'chart' && <div>Ease <select name="" id="" value={objs[focusObj-1].ease}
                        onChange={e => setObjProperty(focusObj-1, 'ease', e.target.value)}>{EaseOpts()}</select></div>}
                        {objs[focusObj-1].type == 'sprite' && <div>source URL<input type="text" name="" id="" value={objs[focusObj-1].src}
                        onChange={e => setObjProperty(focusObj-1, 'src', e.target.value)}/></div>}
                    </>
                }
            </div>
            <div style={{width:`${100-mainsetLine-eventsetLine}%`}} className="scene">
                <BattleRenderer
                    timeline={timeline}
                    stageSize={stageSize}
                    renderData={renderData}
                    judgements={judgements}
                    surfaceLabel="battle-editor"
                />
                <div
                    className={`editor-playtest-status ${playtestStatus}`}
                    data-editor-playtest-status={playtestStatus}
                    aria-live="polite"
                >
                    <span className="status-dot" />
                    <strong>{playtestLabel[playtestStatus]}</strong>
                    <span>{timeline.toFixed(3)}s</span>
                </div>
                {playtestStatus !== 'idle' && <BattleGauge gauge={gauge} className="editor-battle-gauge" />}
                {!song && <div className="editor-preview-hint">Set a song source to start playtest.</div>}
                {(playtestStatus === 'failed' || playtestStatus === 'cleared') && <div
                    className={`editor-playtest-result ${playtestStatus}`}
                    role="dialog"
                    aria-labelledby="editor-playtest-result-title"
                >
                    <span>PLAYTEST</span>
                    <h2 id="editor-playtest-result-title">
                        {playtestStatus === 'failed' ? 'Game Over' : 'Clear'}
                    </h2>
                    <p>HP {gauge.health} · start {playtestStart.toFixed(3)}s</p>
                    <div>
                        <button type="button" onClick={() => void startPlaytestAt(playtestStart)}>Restart</button>
                        <button type="button" onClick={returnToEditing}>Return to Edit</button>
                    </div>
                </div>}
            </div>
            <div style={{width:`${eventsetLine}%`}} className="eventset">
                {timelineSelection.length > 1 && timelineSelectionSummary && <section className="timeline-selection-summary" aria-live="polite">
                    <div>
                        <strong>{timelineSelection.length} items selected</strong>
                        <span>{timelineSelectionSummary.start.toFixed(3)}s–{timelineSelectionSummary.end.toFixed(3)}s</span>
                    </div>
                    <p>Properties below edit the active item only.</p>
                    <div className="selection-actions">
                        <button type="button" onClick={alignSelectedTimelineNodes} title="Align every selected item to the active item's time (Ctrl/Cmd+Shift+L)">
                            Align to {timelineSelectionSummary.active.toFixed(3)}s
                        </button>
                        <button type="button" className="danger" onClick={deleteSelectedTimelineNodes}>Delete</button>
                    </div>
                </section>}
                {focusEvent[0] == 0 ? <>
                    <div>Time (s)<input aria-label="Event time in seconds" type="number" step="0.001" value={events[focusEvent[1]].stamp} onChange={e => setEv(focusEvent[1], 'stamp', +e.target.value)}/></div>
                    <div>Type<select aria-label="Event type" value={events[focusEvent[1]].type} onChange={e => setEv(focusEvent[1], 'type', e.target.value)}>
                        <option value="bgcolor">BackgroundColor</option>
                        <option value="filter">Filter</option>
                        <option value="wiggle">Wiggle</option>
                        <option value="position">Position</option>
                        <option value="rotate">Rotate</option>
                        <option value="scale">Scale</option>
                    </select></div>
                    {['rotate', 'scale'].includes(events[focusEvent[1]].type) && <div>Value<input type="number"
                    value={inputEventValue(events[focusEvent[1]].value)} onChange={e => setEv(focusEvent[1], 'value', +e.target.value)}/></div>}
                    {events[focusEvent[1]].type === 'wiggle' && <>
                        <p className="event-editor-help">Smooth procedural motion. 10 amplitude units = 1% of the frame.</p>
                        <div>Amplitude<input aria-label="Wiggle amplitude" type="number" step="1" value={inputEventValue(events[focusEvent[1]].value)} onChange={e => setEv(focusEvent[1], 'value', +e.target.value)}/></div>
                        <div>Length (s)<input aria-label="Wiggle length in seconds" type="number" min="0.01" step="0.01"
                        value={Number(wiggleDurationSeconds(events[focusEvent[1]]).toFixed(3))} onChange={e => setEv(focusEvent[1], 'duration', wiggleDurationRate(+e.target.value))}/></div>
                        <div>Frequency (Hz)<input aria-label="Wiggle frequency in hertz" type="number" min="0.01" max="60" step="0.1"
                        value={events[focusEvent[1]].speed ?? 5} onChange={e => setEv(focusEvent[1], 'speed', +e.target.value)}/></div>
                        <div>Axes<select aria-label="Wiggle axes" value={events[focusEvent[1]].axis ?? 'y'} onChange={e => setEv(focusEvent[1], 'axis', e.target.value as wiggleAxis)}>
                            <option value="both">X + Y</option>
                            <option value="x">X only</option>
                            <option value="y">Y only</option>
                        </select></div>
                        <div>Complexity<input aria-label="Wiggle complexity" type="number" min="1" max="8" step="1"
                        value={events[focusEvent[1]].octaves ?? 3} onChange={e => setEv(focusEvent[1], 'octaves', +e.target.value)}/></div>
                        <div>Falloff<input aria-label="Wiggle detail falloff" type="number" min="0.05" max="1" step="0.05"
                        value={events[focusEvent[1]].falloff ?? 0.5} onChange={e => setEv(focusEvent[1], 'falloff', +e.target.value)}/></div>
                        <div>Seed<input aria-label="Wiggle random seed" type="number" step="1"
                        value={events[focusEvent[1]].seed ?? Math.round(events[focusEvent[1]].stamp * 1000)} onChange={e => setEv(focusEvent[1], 'seed', +e.target.value)}/></div>
                        <div>Smooth exit<input aria-label="Wiggle smooth exit" type="checkbox"
                        checked={events[focusEvent[1]].smooth ?? true} onChange={e => setEv(focusEvent[1], 'smooth', e.target.checked)}/></div>
                    </>}
                    {['filter'].includes(events[focusEvent[1]].type) && <div>Filter Type<select name="" id="" value={events[focusEvent[1]].filter} onChange={e => setEv(focusEvent[1], 'filter', e.target.value)}>
                    <option value="blur">Blur</option>
                    <option value="dot">Dot</option>
                    <option value="motionBlur">Motion Blur</option>
                    <option value="bloom">Bloom</option>
                    <option value="godray">Godray</option>
                    <option value="convolution">Convolution</option>
                    <option value="glitch">Glitch</option>
                    <option value="grayscale">Grayscale</option>
                    <option value="noise">Noise</option>
                    <option value="pixelate">Pixelate</option>
                    <option value="rgbsplit">RGB Split</option>
                    </select></div>}
                    {['filter'].includes(events[focusEvent[1]].type) && strengthFilters.includes(events[focusEvent[1]].filter as filterType) &&
                    <div>Strength<input type="number" name="" id="" value={inputEventValue(events[focusEvent[1]].value)} onChange={e => setEv(focusEvent[1], 'value', +e.target.value)}/></div>}
                    {['filter'].includes(events[focusEvent[1]].type) &&
                    enableFilters.includes(events[focusEvent[1]].filter as filterType) &&
                    <div>Enable<input type="checkbox" name="" id="" checked={events[focusEvent[1]].value != 0} onChange={e => setEv(focusEvent[1], 'value', e.target.checked ? 100 : 0)}/></div>}
                    {['position'].includes(events[focusEvent[1]].type) && <div>Value<input type="number" name="" id=""
                    value={vectorEventValue(events[focusEvent[1]].value)[0]} onChange={e => setEv(focusEvent[1], 'value', [+e.target.value, vectorEventValue(events[focusEvent[1]].value)[1]])}/><input type="number" name="" id=""
                    value={vectorEventValue(events[focusEvent[1]].value)[1]} onChange={e => setEv(focusEvent[1], 'value', [vectorEventValue(events[focusEvent[1]].value)[0], +e.target.value])}/></div>}
                    {['bgcolor'].includes(events[focusEvent[1]].type) && <div>Color<input type="color" name="" id=""
                    value={inputEventValue(events[focusEvent[1]].value)} onChange={e => setEv(focusEvent[1], 'value', e.target.value)}/></div>}
                    {['filter', 'bgcolor', 'position', 'rotate', 'scale'].includes(events[focusEvent[1]].type) &&
                    (events[focusEvent[1]].type == 'filter' ? strengthFilters.includes(events[focusEvent[1]].filter as filterType) : true) && <div>Duration<input type="number" name="" id=""
                    value={events[focusEvent[1]].duration} onChange={e => setEv(focusEvent[1], 'duration', +e.target.value)}/></div>}
                    {['filter', 'bgcolor', 'position', 'rotate', 'scale'].includes(events[focusEvent[1]].type) &&
                    (events[focusEvent[1]].type == 'filter' ? strengthFilters.includes(events[focusEvent[1]].filter as filterType) : true) && <div>Ease<select name="" id=""
                    value={events[focusEvent[1]].ease} onChange={e => setEv(focusEvent[1], 'ease', e.target.value)}>{EaseOpts()}</select></div>}
                </>:
                focusEvent[0] > 0 ? <>
                    <div>TimeStamp<input type="text" name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].stamp} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'stamp', +e.target.value)}/></div>
                    <div>Type<select name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].type} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'type', e.target.value)}>
                        <option value="position">Transform</option>
                        <option value="rotate">Rotate</option>
                        <option value="scale">Scale</option>
                        <option value="opacity">Opacity</option>
                        <option value="anchor">Anchor</option>
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="bpm">BPM</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="ease">Ease</option>}
                        <option value="visible">Visible</option>
                        {objs[focusEvent[0]-1].type == 'sprite' && <option value="change">Change Image</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="mcolor">Main Color</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="jcolor">Judge Color</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="ncolor">Note Color</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="drawer">Note Drawer</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="shape">Note Shape</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="line">Main Line</option>}
                        {objs[focusEvent[0]-1].type == 'chart' && <option value="nline">Note Line</option>}
                    </select></div>
                    {['position', 'rotate', 'scale', 'opacity', 'anchor', 'bpm', 'mcolor', 'jcolor', 'ncolor', 'line', 'nline'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) && <div>Duration<input type="number" name="" id=""
                    value={objs[focusEvent[0]-1].events[focusEvent[1]].duration} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'duration', +e.target.value)}/></div>}
                    {['position', 'rotate', 'scale', 'opacity', 'anchor', 'bpm', 'mcolor', 'jcolor', 'ncolor', 'line', 'nline'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) && <div>Ease<select name="" id=""
                    value={objs[focusEvent[0]-1].events[focusEvent[1]].ease} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'ease', e.target.value)}>{EaseOpts()}</select></div>}
                    {['mcolor', 'jcolor', 'ncolor'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Color Value<input type="color" name="" id=""
                    value={inputEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.value)}/></div> :
                    ['rotate', 'opacity', 'bpm', 'change', 'line', 'nline'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Value<input type="text" name="" id=""
                    value={inputEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.value)}/></div>:
                    ['position', 'scale', 'anchor'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Value<input type="number" name="" id=""
                    value={vectorEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)[0]} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', [+e.target.value, vectorEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)[1]])}/>
                    <input type="number" name="" id="" value={vectorEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)[1]} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', [vectorEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)[0], +e.target.value])}/></div>:
                    ['ease'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>EaseType<select name="" id="" value={objs[focusEvent[0]-1].events[focusEvent[1]].ease} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'ease', e.target.value)}>{EaseOpts()}</select></div>:
                    ['visible'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Visible<input type="checkbox" name="" id=""
                    checked={booleanEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.checked)}/></div>:
                    ['drawer'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Note Drawer<select name="" id="" value={inputEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.value)}>
                    <option value="stroke">Stroke</option><option value="fill">Fill</option></select></div>:
                    ['shape'].includes(objs[focusEvent[0]-1].events[focusEvent[1]].type) ? <div>Note Shape<select name="" id="" value={inputEventValue(objs[focusEvent[0]-1].events[focusEvent[1]].value)} onChange={e => setObjEv(focusEvent[0]-1, focusEvent[1], 'value', e.target.value)}>
                    <option value="arc">Arc</option><option value="rect">Rect</option></select></div>:<></>
                    }
                </>:<></>}
            </div>
        </div>
        <div style={{height:`${underbarLine}%`}} className="underbar">
            <div ref={objectsRef} style={{width:`${objLine}%`}} className="objs">
                <div className="description">Objects {timeline.toFixed(3)}
                    <div className="right">
                    <select name="" id="" value={sel} onChange={e => setSel(e.target.value as 'chart'|'sprite')}>
                        <option value="chart">Chart</option>
                        <option value="sprite">Sprite</option>
                    </select>
                    <button onClick={() => addObj()}>+</button></div>
                </div>
                {colScroll <= 0 && <div className={focusObj == 0 ? 'selected' : ''}
                onClick={() => {clearTimelineSelection();setFocusObj(0);setFocusing(0)}}>Main<button onClick={() => addEv()}>Add Event</button></div>}
                {objs.map((v, i) => (
                    colScroll <= i+1 && <div key={i} className={focusObj == i+1 ? 'selected' : ''} onClick={() => {clearTimelineSelection();setFocusObj(i+1);setFocusing(0)}}>{`Obj${i+1}`}
                    {v.type == 'chart' && <button onClick={() => addChartNote(i)}>Add Note</button>}
                    <button onClick={() => addObjEv(i)}>Add Event</button></div>
                ))}
            </div>
            <div
                ref={timelineElementRef}
                style={{width:`${100-objLine}%`}}
                className="timeline"
                data-timeline-selection-count={timelineSelection.length}
            >
                <div ref={controlsRef} className="controls">
                    <span className="timeline-timecode" title={`${timeline.toFixed(3)} seconds`}>
                        {formatTimelineTime(timeline, 3)}
                    </span>
                    <div className="timeline-ruler" aria-hidden="true">
                        {rulerMarks.map(mark => {
                            const pixel = timelinePixel(mark.stamp)
                            if (pixel < 72) return null
                            return <span key={mark.stamp} style={{ left:`${pixel}px` }}>{mark.label}</span>
                        })}
                    </div>
                    {isTimelineMarkerVisible(playheadPixel, timelineViewportWidth, 12) && <div
                        style={{left:`${playheadPixel - 12}px`}}
                        className="timelineGrab"
                    />}
                    <span className="timeline-selection-help">
                        {activeTimelineStack
                            ? 'Stack open · click an item · Shift-click badge selects all'
                            : timelineSelection.length > 0
                            ? `${timelineSelection.length} selected · drag / arrows / delete`
                            : 'Drag-select · click stacks to fan out · Alt-wheel zoom'}
                    </span>
                </div>
                <div className="overlay">
                    {gridLine.map((value, index) => {
                        const isStart = index === 0
                        const isEnd = index + 1 === gridLine.length
                        if (!isStart && !isEnd && index % gridDensityFactor !== 0) return null
                        const pixel = timelinePixel(isEnd ? endpoint : value + gridOffset)
                        if (!isTimelineMarkerVisible(pixel, timelineViewportWidth, 1)) return null
                        const className = isStart
                            ? 'grid start'
                            : isEnd
                                ? 'grid end'
                                : index % (grid * gridDensityFactor) === 0
                                    ? 'grid'
                                    : 'grid m'
                        return <div key={index} style={{left:`${pixel}px`}} className={className} />
                    })}
                    {isTimelineMarkerVisible(playheadPixel, timelineViewportWidth, 1) && <div
                        className="bar"
                        style={{left:`${playheadPixel}px`}}
                    />}
                </div>
                <div
                    ref={eventsElementRef}
                    className="events"
                    onPointerDown={timelineMarqueePointerDown}
                    onPointerMove={timelineMarqueePointerMove}
                    onPointerUp={pointer => finishTimelineMarquee(pointer)}
                    onPointerCancel={pointer => finishTimelineMarquee(pointer, true)}
                >
                    {timelineMarquee && <div
                        className="timeline-marquee"
                        style={{
                            left:Math.min(timelineMarquee.startClientX, timelineMarquee.currentClientX),
                            top:Math.min(timelineMarquee.startClientY, timelineMarquee.currentClientY),
                            width:Math.abs(timelineMarquee.currentClientX - timelineMarquee.startClientX),
                            height:Math.abs(timelineMarquee.currentClientY - timelineMarquee.startClientY),
                        }}
                    />}
                    {colScroll <= 0 && <TimelineLane
                        laneId="main"
                        top={0}
                        markers={events.map((eventValue, eventIndex) => {
                            const node:TimelineNodeRef = { kind:'main-event', index:eventIndex }
                            return eventMarker(node, eventValue.stamp, timelinePixel(eventValue.stamp), eventValue.type, 'Main')
                        })}
                        viewportWidth={timelineViewportWidth}
                        selectedKeys={selectedTimelineNodeKeys}
                        dragging={timelineNodesDragging}
                        activeStackKey={activeTimelineStack}
                        onActiveStackChange={setActiveTimelineStack}
                        onNodePointerDown={timelineNodePointerDown}
                        onNodeKeyDown={timelineNodeKeyDown}
                        onSelectGroup={applyTimelineSelection}
                    />}
                    {objs.map((object, objectIndex) => (
                        colScroll <= objectIndex + 1 && <TimelineLane
                            key={objectIndex}
                            laneId={`object-${objectIndex}`}
                            top={(objectIndex + 1 - colScroll) * TIMELINE_LANE_HEIGHT}
                            markers={[
                                ...object.events.map((objectEvent, eventIndex) => {
                                const node:TimelineNodeRef = { kind:'object-event', objectIndex, index:eventIndex }
                                    return eventMarker(
                                        node,
                                        objectEvent.stamp,
                                        timelinePixel(objectEvent.stamp),
                                        objectEvent.type,
                                        `Object ${objectIndex + 1}`,
                                    )
                                }),
                                ...(object.type === 'chart' ? (object.notes ?? []).map((note, noteIndex):TimelineLaneMarker => ({
                                    node:{ kind:'note', objectIndex, index:noteIndex },
                                    stamp:note.stamp,
                                    pixel:timelinePixel(note.stamp),
                                    kind:'note',
                                    eventType:'note',
                                    shortLabel:'NT',
                                    label:`Object ${objectIndex + 1} note at ${note.stamp.toFixed(3)} seconds`,
                                })) : []),
                            ]}
                            viewportWidth={timelineViewportWidth}
                            selectedKeys={selectedTimelineNodeKeys}
                            dragging={timelineNodesDragging}
                            activeStackKey={activeTimelineStack}
                            onActiveStackChange={setActiveTimelineStack}
                            onNodePointerDown={timelineNodePointerDown}
                            onNodeKeyDown={timelineNodeKeyDown}
                            onSelectGroup={applyTimelineSelection}
                        />
                    ))}
                </div>
                <div ref={scrollbarTrackRef} className="scrollbar-row"><div
                    ref={scrollbarThumbRef}
                    style={{width:`${scrollbar.thumbWidth}px`, left:`${scrollbar.thumbLeft}px`}}
                /></div>
            </div>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleLevelFile} style={{display:'none'}} />
        <audio
            ref={audioElementRef}
            data-testid="editor-audio"
            src={song || undefined}
            preload="auto"
            style={{display:'none'}}
            onCanPlayThrough={event => completeAudio(event.currentTarget)}
            onPlaying={() => {
                setPlaying(true)
                setPlaytestStatus('running')
            }}
            onPause={() => {
                setPlaying(false)
                setPlaytestStatus(current => gaugeRef.current.failed
                    ? 'failed'
                    : current === 'running' ? 'paused' : current
                )
            }}
            onWaiting={() => setPlaying(false)}
            onEnded={event => {
                const endTimeline = clampTimeline(audioTimeToTimeline(event.currentTarget.currentTime, offset), endpoint)
                timelineRef.current = endTimeline
                setTimeline(endTimeline)
                setPlaying(false)
                setPlaytestStatus(current => current === 'running' ? 'cleared' : current)
            }}
            onError={event => failAudio(event.currentTarget)}
        ></audio>
    </div>
}
