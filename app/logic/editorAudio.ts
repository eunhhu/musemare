import type { JudgementState } from './battleDomain'

type PausableAudio = {
    pause:() => void
}

type SeekableAudio = {
    currentTime:number
    readyState:number
}

type MutableValue<T> = {
    current:T
}

export function pauseAudioForLevelImport(audio:PausableAudio | null | undefined) {
    audio?.pause()
}

export function seekAudioToLevelStart(audio:SeekableAudio, offset:number) {
    if (audio.readyState < 1 || !Number.isFinite(offset)) return false
    audio.currentTime = Math.max(offset, 0)
    return true
}

export function clearEditorSeekEpoch(
    pendingHitsRef:MutableValue<number[]>,
    judgementsRef:MutableValue<JudgementState>,
    renderJudgements:(judgements:JudgementState) => void,
) {
    const clearedJudgements:JudgementState = {}
    pendingHitsRef.current = []
    judgementsRef.current = clearedJudgements
    renderJudgements(clearedJudgements)
}
