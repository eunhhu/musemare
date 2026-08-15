import { clamp } from './editorLayout'
import { timelineNodeKey, type TimelineNodeRef } from './editorTimelineNodes'

export type TimelineClusterItem<T = unknown> = {
    node:TimelineNodeRef
    stamp:number
    pixel:number
    data:T
}

export type TimelineCluster<T = unknown> = {
    key:string
    items:TimelineClusterItem<T>[]
    anchorPixel:number
    startStamp:number
    endStamp:number
}

export function clusterTimelineItems<T>(
    laneId:string,
    items:TimelineClusterItem<T>[],
    minimumGap = 22,
):TimelineCluster<T>[] {
    const safeGap = Math.max(1, Number.isFinite(minimumGap) ? minimumGap : 22)
    const ordered = [...items].sort((left, right) =>
        left.pixel - right.pixel
        || left.stamp - right.stamp
        || timelineNodeKey(left.node).localeCompare(timelineNodeKey(right.node))
    )
    const groups:TimelineClusterItem<T>[][] = []
    for (const item of ordered) {
        const current = groups.at(-1)
        if (!current || item.pixel - current.at(-1)!.pixel >= safeGap) groups.push([item])
        else current.push(item)
    }

    return groups.map(group => ({
        key:`${laneId}:${group.map(item => timelineNodeKey(item.node)).join('|')}`,
        items:group,
        anchorPixel:group.reduce((total, item) => total + item.pixel, 0) / group.length,
        startStamp:Math.min(...group.map(item => item.stamp)),
        endStamp:Math.max(...group.map(item => item.stamp)),
    }))
}

export function fanTimelineCluster(
    anchorPixel:number,
    count:number,
    viewportWidth:number,
    markerWidth = 18,
    gap = 5,
) {
    if (count <= 0) return []
    const viewport = Math.max(markerWidth + 4, viewportWidth)
    const spacing = markerWidth + gap
    const rightStart = anchorPixel + markerWidth + gap
    const rightEnd = rightStart + (count - 1) * spacing + markerWidth
    if (rightEnd <= viewport - 2) {
        return Array.from({ length:count }, (_, index) => rightStart + index * spacing)
    }

    const leftStart = anchorPixel - markerWidth - gap - (count - 1) * spacing
    if (leftStart >= 2) {
        return Array.from({ length:count }, (_, index) => leftStart + index * spacing)
    }

    const available = Math.max(0, viewport - markerWidth - 4)
    const actualSpacing = count > 1 ? Math.min(spacing, available / (count - 1)) : 0
    const span = actualSpacing * (count - 1)
    const start = clamp(anchorPixel - span / 2, 2, Math.max(2, viewport - markerWidth - span - 2))
    return Array.from({ length:count }, (_, index) => start + index * actualSpacing)
}
