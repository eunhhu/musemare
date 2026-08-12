import { describe, expect, it } from 'vitest'
import { createRuntimeAssetFailure } from '../../app/logic/runtimeAssets'
import {
    getPendingRuntimeTaskCount,
    getRuntimeFailure,
    initialRuntimeTaskState,
    runtimeTaskReducer,
} from '../../app/logic/runtimeStatusDomain'

const task = { kind:'asset', source:'/assets/object/white.png' } as const

describe('runtime task lifecycle', () => {
    it('keeps an early completion settled when registration follows', () => {
        const generation = Symbol('asset')
        let state = runtimeTaskReducer(initialRuntimeTaskState, {
            type:'complete',
            id:'asset',
            generation,
        })
        state = runtimeTaskReducer(state, {
            type:'begin',
            id:'asset',
            generation,
            task,
        })

        expect(getPendingRuntimeTaskCount(state)).toBe(0)
    })

    it('keeps an early failure visible when registration follows', () => {
        const generation = Symbol('asset')
        const failure = createRuntimeAssetFailure(task.source, new Error('decode failed'))
        let state = runtimeTaskReducer(initialRuntimeTaskState, {
            type:'fail',
            id:'asset',
            generation,
            failure,
        })
        state = runtimeTaskReducer(state, {
            type:'begin',
            id:'asset',
            generation,
            task,
        })

        expect(getRuntimeFailure(state)).toEqual(failure)
        expect(getPendingRuntimeTaskCount(state)).toBe(0)
    })

    it('does not let stale terminal actions clear a newer generation', () => {
        const oldGeneration = Symbol('old')
        const newGeneration = Symbol('new')
        let state = runtimeTaskReducer(initialRuntimeTaskState, {
            type:'begin',
            id:'asset',
            generation:oldGeneration,
            task,
        })
        state = runtimeTaskReducer(state, {
            type:'begin',
            id:'asset',
            generation:newGeneration,
            task,
        })
        const newState = state

        state = runtimeTaskReducer(state, { type:'complete', id:'asset', generation:oldGeneration })
        expect(state).toBe(newState)
        state = runtimeTaskReducer(state, { type:'cancel', id:'asset', generation:oldGeneration })
        expect(state).toBe(newState)
        expect(getPendingRuntimeTaskCount(state)).toBe(1)

        state = runtimeTaskReducer(state, { type:'complete', id:'asset', generation:newGeneration })
        expect(getPendingRuntimeTaskCount(state)).toBe(0)
    })
})
