import type { camera } from '../data/types'

export type DragPoint = [number, number]

export type CanvasClientRectangle = {
    left:number
    top:number
    width:number
    height:number
}

export type DragRectangle = {
    x:number
    y:number
    width:number
    height:number
}

export function normalizeDragRectangle(start:DragPoint, end:DragPoint):DragRectangle | undefined {
    const width = Math.abs(end[0] - start[0])
    const height = Math.abs(end[1] - start[1])
    if (width === 0 || height === 0) return undefined

    return {
        x:Math.min(start[0], end[0]),
        y:Math.min(start[1], end[1]),
        width,
        height,
    }
}

function exploreScale(stageSize:DragPoint, viewCamera:camera) {
    return viewCamera.scale * (Math.max(stageSize[0], stageSize[1]) / 1000)
}

export function worldToScreen(point:DragPoint, stageSize:DragPoint, viewCamera:camera):DragPoint {
    const scale = exploreScale(stageSize, viewCamera)
    const radians = viewCamera.rotation * Math.PI / 180
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)
    const translatedX = (point[0] - viewCamera.position[0]) * scale
    const translatedY = (point[1] - viewCamera.position[1]) * scale

    return [
        stageSize[0] / 2 + translatedX * cosine - translatedY * sine,
        stageSize[1] / 2 + translatedX * sine + translatedY * cosine,
    ]
}

export function screenToWorld(point:DragPoint, stageSize:DragPoint, viewCamera:camera):DragPoint | undefined {
    const scale = exploreScale(stageSize, viewCamera)
    if (!Number.isFinite(scale) || scale === 0) return undefined

    const radians = viewCamera.rotation * Math.PI / 180
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)
    const centeredX = point[0] - stageSize[0] / 2
    const centeredY = point[1] - stageSize[1] / 2

    return [
        viewCamera.position[0] + (centeredX * cosine + centeredY * sine) / scale,
        viewCamera.position[1] + (-centeredX * sine + centeredY * cosine) / scale,
    ]
}

export function clientPointToWorld(
    point:DragPoint,
    rectangle:CanvasClientRectangle,
    stageSize:DragPoint,
    viewCamera:camera,
) {
    if (rectangle.width <= 0 || rectangle.height <= 0) return undefined
    const screenPoint:DragPoint = [
        (point[0] - rectangle.left) * stageSize[0] / rectangle.width,
        (point[1] - rectangle.top) * stageSize[1] / rectangle.height,
    ]
    return screenToWorld(screenPoint, stageSize, viewCamera)
}
