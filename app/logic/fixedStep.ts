export const FIXED_STEP_MS = 10
export const MAX_CATCH_UP_STEPS = 10

export function consumeFixedSteps(
    accumulatorMs:number,
    elapsedMs:number,
    stepMs = FIXED_STEP_MS,
    maxCatchUpSteps = MAX_CATCH_UP_STEPS,
) {
    if (!Number.isFinite(accumulatorMs) || !Number.isFinite(elapsedMs) || stepMs <= 0 || maxCatchUpSteps <= 0) {
        return { steps:0, remainderMs:0 }
    }

    const maxAccumulatedMs = stepMs * maxCatchUpSteps
    const accumulated = Math.min(
        Math.max(accumulatorMs, 0) + Math.max(elapsedMs, 0),
        maxAccumulatedMs,
    )
    const steps = Math.min(Math.floor(accumulated / stepMs), maxCatchUpSteps)

    return {
        steps,
        remainderMs:accumulated - steps * stepMs,
    }
}
