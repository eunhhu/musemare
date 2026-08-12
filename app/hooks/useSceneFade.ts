'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const fadeDuration = 250

export function useSceneFade(setScene: (scene: string) => void) {
    const [brightness, setBrightness] = useState(0)
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => {
        const frame = requestAnimationFrame(() => setBrightness(1))
        return () => {
            cancelAnimationFrame(frame)
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    const transitionTo = useCallback((scene: string) => {
        if (timeoutRef.current) {
            return
        }
        setBrightness(0)
        timeoutRef.current = setTimeout(() => setScene(scene), fadeDuration)
    }, [setScene])

    return {
        transitionTo,
        style: {
            filter: `brightness(${brightness})`,
            transition: `filter ${fadeDuration}ms linear`,
        },
    }
}
