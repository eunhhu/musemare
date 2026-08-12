import type { RuntimeAssetFailure } from './runtimeAssets'

export type RuntimeTaskKind = 'asset' | 'surface'

export type RuntimeTask = {
    kind:RuntimeTaskKind
    source:string
}

export type RuntimeTaskGeneration = string | number | symbol

type PendingRuntimeTask = RuntimeTask & {
    generation:RuntimeTaskGeneration
    status:'pending'
}

type PrecompletedRuntimeTask = {
    generation:RuntimeTaskGeneration
    status:'precompleted'
}

type FailedRuntimeTask = {
    generation:RuntimeTaskGeneration
    status:'failed'
    failure:RuntimeAssetFailure
}

export type RuntimeTaskEntry = PendingRuntimeTask | PrecompletedRuntimeTask | FailedRuntimeTask

export type RuntimeTaskState = {
    tasks:Record<string, RuntimeTaskEntry>
}

export type RuntimeTaskAction =
    | { type:'begin', id:string, generation:RuntimeTaskGeneration, task:RuntimeTask }
    | { type:'complete', id:string, generation:RuntimeTaskGeneration }
    | { type:'cancel', id:string, generation:RuntimeTaskGeneration }
    | { type:'fail', id:string, generation:RuntimeTaskGeneration, failure:RuntimeAssetFailure }
    | { type:'dispose' }

export const initialRuntimeTaskState:RuntimeTaskState = { tasks:{} }

export function runtimeTaskReducer(state:RuntimeTaskState, action:RuntimeTaskAction):RuntimeTaskState {
    if (action.type === 'dispose') {
        return Object.keys(state.tasks).length === 0 ? state : initialRuntimeTaskState
    }
    if (action.type === 'begin') {
        const current = state.tasks[action.id]
        if (current?.generation === action.generation) {
            if (current.status !== 'precompleted') return state
            const tasks = { ...state.tasks }
            delete tasks[action.id]
            return Object.keys(tasks).length === 0 ? initialRuntimeTaskState : { tasks }
        }
        return {
            tasks:{
                ...state.tasks,
                [action.id]:{
                    ...action.task,
                    generation:action.generation,
                    status:'pending',
                },
            },
        }
    }

    const current = state.tasks[action.id]
    if (!current) {
        if (action.type === 'complete') {
            return {
                tasks:{
                    ...state.tasks,
                    [action.id]:{
                        generation:action.generation,
                        status:'precompleted',
                    },
                },
            }
        }
        if (action.type === 'fail') {
            return {
                tasks:{
                    ...state.tasks,
                    [action.id]:{
                        generation:action.generation,
                        status:'failed',
                        failure:action.failure,
                    },
                },
            }
        }
        return state
    }
    if (current.generation !== action.generation) return state

    if (action.type === 'cancel') {
        const tasks = { ...state.tasks }
        delete tasks[action.id]
        return Object.keys(tasks).length === 0 ? initialRuntimeTaskState : { tasks }
    }

    if (current.status !== 'pending') return state

    if (action.type === 'fail') {
        return {
            tasks:{
                ...state.tasks,
                [action.id]:{
                    generation:current.generation,
                    status:'failed',
                    failure:action.failure,
                },
            },
        }
    }

    const tasks = { ...state.tasks }
    delete tasks[action.id]
    return Object.keys(tasks).length === 0 ? initialRuntimeTaskState : { tasks }
}

export function getPendingRuntimeTaskCount(state:RuntimeTaskState) {
    return Object.values(state.tasks).filter(task => task.status === 'pending').length
}

export function getRuntimeFailure(state:RuntimeTaskState) {
    return Object.values(state.tasks).find(task => task.status === 'failed')?.failure
}
