export type EditorPanelLayout = {
    underbar:number
    mainset:number
    eventset:number
    objects:number
}

export function clamp(value:number, minimum:number, maximum:number) {
    return Math.min(maximum, Math.max(minimum, value))
}

export function clampEditorPanel(
    panel:keyof EditorPanelLayout,
    value:number,
    layout:EditorPanelLayout,
) {
    if (!Number.isFinite(value)) return layout[panel]
    if (panel === 'underbar') return clamp(value, 10, 80)
    if (panel === 'objects') return clamp(value, 5, 80)
    if (panel === 'mainset') return clamp(value, 5, 80 - layout.eventset)
    return clamp(value, 5, 80 - layout.mainset)
}

export function timelineScrollMetrics(viewportWidth:number, zoomPercent:number, requestedScroll:number) {
    const viewport = Math.max(0, Number.isFinite(viewportWidth) ? viewportWidth : 0)
    const zoom = Math.max(100, Number.isFinite(zoomPercent) ? zoomPercent : 100)
    const contentWidth = viewport * zoom / 100
    const maxScroll = Math.max(0, contentWidth - viewport)
    const scroll = maxScroll === 0
        ? 0
        : clamp(Number.isFinite(requestedScroll) ? requestedScroll : 0, -maxScroll, 0)
    const thumbWidth = contentWidth > 0 ? viewport * viewport / contentWidth : viewport
    const thumbTravel = Math.max(0, viewport - thumbWidth)
    const thumbLeft = maxScroll > 0 ? (-scroll / maxScroll) * thumbTravel : 0
    return { contentWidth, maxScroll, scroll, thumbWidth, thumbTravel, thumbLeft }
}

export function timelinePixelAt(
    stamp:number,
    endpoint:number,
    viewportWidth:number,
    zoomPercent:number,
    scroll:number,
) {
    if (!Number.isFinite(stamp) || !Number.isFinite(endpoint) || endpoint <= 0) return scroll
    const { contentWidth } = timelineScrollMetrics(viewportWidth, zoomPercent, scroll)
    return contentWidth * stamp / endpoint + scroll
}

export function timelineStampAtPixel(
    pixel:number,
    endpoint:number,
    viewportWidth:number,
    zoomPercent:number,
    scroll:number,
) {
    if (!Number.isFinite(endpoint) || endpoint <= 0) return 0
    const { contentWidth } = timelineScrollMetrics(viewportWidth, zoomPercent, scroll)
    if (contentWidth <= 0) return 0
    return clamp(endpoint * (pixel - scroll) / contentWidth, 0, endpoint)
}

export function isTimelineMarkerVisible(pixel:number, viewportWidth:number, radius = 0) {
    if (!Number.isFinite(pixel) || !Number.isFinite(viewportWidth)) return false
    const safeRadius = Math.max(0, Number.isFinite(radius) ? radius : 0)
    return pixel + safeRadius >= 0 && pixel - safeRadius <= Math.max(0, viewportWidth)
}

export function consumeWheelRows(remainder:number, delta:number, threshold = 80) {
    const safeThreshold = Math.max(1, Number.isFinite(threshold) ? threshold : 80)
    const total = (Number.isFinite(remainder) ? remainder : 0) + (Number.isFinite(delta) ? delta : 0)
    const rows = total < 0
        ? Math.ceil(total / safeThreshold)
        : Math.floor(total / safeThreshold)
    return { rows, remainder:total - rows * safeThreshold }
}
