import { describe, expect, it } from 'vitest'
import { createRuntimeAssetFailure, mediaSourceMatches } from '../../app/logic/runtimeAssets'
import {
    getPendingRuntimeTaskCount,
    getRuntimeFailure,
    initialRuntimeTaskState,
    runtimeTaskReducer,
} from '../../app/logic/runtimeStatusDomain'

describe('runtime asset failures', () => {
    it('retains structured source and decode context', () => {
        expect(createRuntimeAssetFailure('/assets/object/broken.png', new Error('decode failed'))).toEqual({
            kind:'asset',
            phase:'decode',
            source:'/assets/object/broken.png',
            message:'decode failed',
        })
    })

    it('matches media events only to the source generation that emitted them', () => {
        const base = 'https://example.test/editor'
        expect(mediaSourceMatches('https://example.test/assets/song/new.mp3', '/assets/song/new.mp3', base)).toBe(true)
        expect(mediaSourceMatches('https://example.test/assets/song/old.mp3', '/assets/song/new.mp3', base)).toBe(false)
        expect(mediaSourceMatches('', '/assets/song/new.mp3', base)).toBe(false)
    })

    it('clears a task failure when that task is retried with a newer generation', () => {
        const failed = runtimeTaskReducer(
            runtimeTaskReducer(initialRuntimeTaskState, {
                type:'begin', id:'sprite', generation:1, task:{ kind:'asset', source:'/broken.png' },
            }),
            {
                type:'fail', id:'sprite', generation:1,
                failure:createRuntimeAssetFailure('/broken.png', new Error('broken')),
            },
        )

        expect(getRuntimeFailure(failed)?.source).toBe('/broken.png')
        const retried = runtimeTaskReducer(failed, {
            type:'begin', id:'sprite', generation:2, task:{ kind:'asset', source:'/valid.png' },
        })
        expect(getRuntimeFailure(retried)).toBeUndefined()
        expect(getPendingRuntimeTaskCount(retried)).toBe(1)
    })

    it('ignores old async completion and failure results after source replacement', () => {
        const replacement = runtimeTaskReducer(
            runtimeTaskReducer(initialRuntimeTaskState, {
                type:'begin', id:'audio', generation:1, task:{ kind:'asset', source:'/old.mp3' },
            }),
            { type:'begin', id:'audio', generation:2, task:{ kind:'asset', source:'/new.mp3' } },
        )
        const staleComplete = runtimeTaskReducer(replacement, { type:'complete', id:'audio', generation:1 })
        const staleFailure = runtimeTaskReducer(staleComplete, {
            type:'fail', id:'audio', generation:1,
            failure:createRuntimeAssetFailure('/old.mp3', new Error('late failure')),
        })

        expect(getPendingRuntimeTaskCount(staleFailure)).toBe(1)
        expect(getRuntimeFailure(staleFailure)).toBeUndefined()
        expect(runtimeTaskReducer(staleFailure, { type:'complete', id:'audio', generation:2 })).toEqual(initialRuntimeTaskState)
    })

    it('clears failed tasks on cancellation and route disposal', () => {
        const failed = runtimeTaskReducer(
            runtimeTaskReducer(initialRuntimeTaskState, {
                type:'begin', id:'asset', generation:1, task:{ kind:'asset', source:'/broken.png' },
            }),
            {
                type:'fail', id:'asset', generation:1,
                failure:createRuntimeAssetFailure('/broken.png', new Error('broken')),
            },
        )

        expect(runtimeTaskReducer(failed, { type:'cancel', id:'asset', generation:1 })).toEqual(initialRuntimeTaskState)
        expect(runtimeTaskReducer(failed, { type:'dispose' })).toEqual(initialRuntimeTaskState)
    })
})
