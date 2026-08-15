import { useEffect, useRef } from 'react'
import { consumeFixedSteps } from '../logic/fixedStep'
import { useAnimationFrame } from './useAnimationFrame'

export function useFixedStepAnimation(callback:(steps:number) => void, enabled = true) {
    const callbackRef = useRef(callback)
    const previousTimestampRef = useRef<number | undefined>(undefined)
    const accumulatorRef = useRef(0)

    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    useEffect(() => {
        previousTimestampRef.current = undefined
        accumulatorRef.current = 0
    }, [enabled])

    useAnimationFrame(timestamp => {
        const previousTimestamp = previousTimestampRef.current
        previousTimestampRef.current = timestamp
        if (previousTimestamp === undefined) return

        const fixed = consumeFixedSteps(accumulatorRef.current, timestamp - previousTimestamp)
        accumulatorRef.current = fixed.remainderMs
        if (fixed.steps > 0) callbackRef.current(fixed.steps)
    }, enabled)
}
