import type {
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
} from 'react'
import { clamp } from '../logic/editorLayout'
import {
    clusterTimelineItems,
    fanTimelineCluster,
    type TimelineClusterItem,
} from '../logic/editorTimelineClusters'
import { timelineNodeKey, type TimelineNodeRef } from '../logic/editorTimelineNodes'

export type TimelineLaneMarker = {
    node:TimelineNodeRef
    stamp:number
    pixel:number
    kind:'event'|'note'
    eventType:string
    shortLabel:string
    label:string
}

type TimelineLaneProps = {
    laneId:string
    top:number
    markers:TimelineLaneMarker[]
    viewportWidth:number
    selectedKeys:Set<string>
    dragging:boolean
    activeStackKey:string | null
    onActiveStackChange:(key:string | null) => void
    onNodePointerDown:(pointer:ReactPointerEvent<HTMLElement>, node:TimelineNodeRef) => void
    onNodeKeyDown:(keyboard:ReactKeyboardEvent<HTMLElement>, node:TimelineNodeRef) => void
    onSelectGroup:(nodes:TimelineNodeRef[]) => void
}

function markerLeft(pixel:number, viewportWidth:number) {
    return clamp(pixel - 9, 2, Math.max(2, viewportWidth - 20))
}

function markerClass(marker:TimelineLaneMarker, selected:boolean, dragging:boolean) {
    return [
        'timeline-marker',
        marker.kind,
        `event-${marker.eventType}`,
        selected ? 'selected' : '',
        dragging && selected ? 'dragging' : '',
    ].filter(Boolean).join(' ')
}

function stampRangeLabel(items:TimelineClusterItem<TimelineLaneMarker>[]) {
    const start = Math.min(...items.map(item => item.stamp))
    const end = Math.max(...items.map(item => item.stamp))
    return Math.abs(end - start) < 0.0005
        ? `${start.toFixed(3)} seconds`
        : `${start.toFixed(3)} to ${end.toFixed(3)} seconds`
}

export function TimelineLane({
    laneId,
    top,
    markers,
    viewportWidth,
    selectedKeys,
    dragging,
    activeStackKey,
    onActiveStackChange,
    onNodePointerDown,
    onNodeKeyDown,
    onSelectGroup,
}:TimelineLaneProps) {
    const visible = markers.filter(marker => marker.pixel >= -24 && marker.pixel <= viewportWidth + 24)
    const clusters = clusterTimelineItems(
        laneId,
        visible.map(marker => ({ node:marker.node, stamp:marker.stamp, pixel:marker.pixel, data:marker })),
    )

    const renderMarker = (marker:TimelineLaneMarker, left:number, fanned = false) => {
        const key = timelineNodeKey(marker.node)
        const selected = selectedKeys.has(key)
        return <button
            type="button"
            key={key}
            style={{ left:`${left}px` }}
            className={`${markerClass(marker, selected, dragging)} ${fanned ? 'fanned' : ''}`}
            data-timeline-node={key}
            data-timeline-stamp={marker.stamp}
            aria-label={marker.label}
            aria-pressed={selected}
            title={marker.label}
            onPointerDown={pointer => onNodePointerDown(pointer, marker.node)}
            onKeyDown={keyboard => onNodeKeyDown(keyboard, marker.node)}
        >
            <span aria-hidden="true">{marker.shortLabel}</span>
        </button>
    }

    return <div className="timeline-lane" style={{ top:`${top}px` }} data-timeline-lane={laneId}>
        {clusters.map(cluster => {
            if (cluster.items.length === 1) {
                const marker = cluster.items[0].data
                return renderMarker(marker, markerLeft(marker.pixel, viewportWidth))
            }

            const nodes = cluster.items.map(item => item.node)
            const nodeKeys = nodes.map(timelineNodeKey)
            const selectedCount = nodeKeys.filter(key => selectedKeys.has(key)).length
            const active = activeStackKey === cluster.key
            const stackLeft = markerLeft(cluster.anchorPixel, viewportWidth)
            const range = stampRangeLabel(cluster.items)
            const stackLabel = `${cluster.items.length} stacked timeline items at ${range}`
            const fanPositions = active
                ? fanTimelineCluster(cluster.anchorPixel, cluster.items.length, viewportWidth)
                : []

            return <div className={`timeline-stack ${active ? 'expanded' : ''}`} key={cluster.key}>
                {active && cluster.items.map((item, index) => {
                    const markerCenter = fanPositions[index] + 9
                    const from = Math.min(cluster.anchorPixel, markerCenter)
                    return <span
                        aria-hidden="true"
                        className="timeline-stack-connector"
                        key={`connector-${timelineNodeKey(item.node)}`}
                        style={{ left:`${from}px`, width:`${Math.abs(markerCenter - cluster.anchorPixel)}px` }}
                    />
                })}
                <button
                    type="button"
                    className={`timeline-stack-marker ${active ? 'expanded' : ''} ${selectedCount === nodeKeys.length ? 'selected' : selectedCount > 0 ? 'partially-selected' : ''}`}
                    style={{ left:`${stackLeft}px` }}
                    data-timeline-stack-nodes={nodeKeys.join('|')}
                    data-timeline-stack-count={cluster.items.length}
                    aria-label={`${stackLabel}. Click to ${active ? 'collapse' : 'expand'}; Shift-click selects all.`}
                    aria-expanded={active}
                    title={`${stackLabel}. Click to ${active ? 'collapse' : 'fan out'} · Shift-click selects all`}
                    onPointerDown={pointer => pointer.stopPropagation()}
                    onClick={click => {
                        click.stopPropagation()
                        if (click.shiftKey) onSelectGroup(nodes)
                        onActiveStackChange(active ? null : cluster.key)
                    }}
                >
                    <span aria-hidden="true">{cluster.items.length}</span>
                </button>
                {active && cluster.items.map((item, index) => renderMarker(item.data, fanPositions[index], true))}
            </div>
        })}
    </div>
}
