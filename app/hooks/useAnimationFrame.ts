'use client'

import { useEffect, useRef } from 'react'

export function useAnimationFrame(callback: (timestamp: number) => void, enabled = true) {
    const callbackRef = useRef(callback)

    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    useEffect(() => {
        if (!enabled) {
            return
        }

        let frame = 0
        const tick = (timestamp: number) => {
            callbackRef.current(timestamp)
            frame = requestAnimationFrame(tick)
        }

        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [enabled])
}
