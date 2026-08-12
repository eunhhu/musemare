import { describe, expect, it, vi } from 'vitest'
import { levels } from '../../app/data/level'
import { evaluateJudgements, prepareNotes } from '../../app/logic/battleDomain'
import { clearEditorSeekEpoch, pauseAudioForLevelImport, seekAudioToLevelStart } from '../../app/logic/editorAudio'

describe('editor audio import transport', () => {
    it('pauses the previous source before applying imported metadata', () => {
        const pause = vi.fn()
        pauseAudioForLevelImport({ pause })
        expect(pause).toHaveBeenCalledOnce()
    })

    it('seeks to the imported offset only after metadata is ready', () => {
        const loadingAudio = { currentTime:0, readyState:0 }
        const readyAudio = { currentTime:0, readyState:1 }

        expect(seekAudioToLevelStart(loadingAudio, 2.5)).toBe(false)
        expect(loadingAudio.currentTime).toBe(0)
        expect(seekAudioToLevelStart(readyAudio, 2.5)).toBe(true)
        expect(readyAudio.currentTime).toBe(2.5)
    })

    it('clears queued hits, judgement refs, and rendered judgements across a real-chart seek epoch', () => {
        const preparedNotes = prepareNotes(levels.ending.objs)
        const judged = evaluateJudgements(preparedNotes, [1], 1, {})
        const pendingHitsRef = { current:[6.2] }
        const judgementsRef = { current:judged.judgements }
        const render = vi.fn()

        expect(Object.keys(judgementsRef.current)).toHaveLength(1)
        clearEditorSeekEpoch(pendingHitsRef, judgementsRef, render)

        expect(pendingHitsRef.current).toEqual([])
        expect(judgementsRef.current).toEqual({})
        expect(render).toHaveBeenCalledOnce()
        expect(render).toHaveBeenCalledWith({})
        expect(evaluateJudgements(preparedNotes, pendingHitsRef.current, 0, judgementsRef.current)).toEqual({
            judgements:{},
            pendingHits:[],
        })
    })
})
