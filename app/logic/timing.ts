type GridOptions = {
    bpm: number
    divisions: number
    endpoint: number
    offset: number
}

export function audioTimeToTimeline(currentTime: number, offset: number) {
    return currentTime - offset
}

export function clampTimeline(timeline: number, endpoint: number) {
    return Math.min(Math.max(timeline, 0), endpoint)
}

export function buildGridLines({ bpm, divisions, endpoint, offset }: GridOptions) {
    if (bpm <= 0 || divisions <= 0 || endpoint <= offset) {
        return [Math.max(endpoint - offset, 0)]
    }

    const step = 60 / bpm / divisions
    const duration = endpoint - offset
    const lines = Array.from(
        { length: Math.floor(duration / step) },
        (_, index) => index * step,
    )

    if (lines.at(-1) !== duration) {
        lines.push(duration)
    }

    return lines
}
