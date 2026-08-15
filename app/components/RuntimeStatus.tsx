import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import type { RuntimeAssetFailure } from '../logic/runtimeAssets'
import {
    getPendingRuntimeTaskCount,
    getRuntimeFailure,
    initialRuntimeTaskState,
    runtimeTaskReducer,
    type RuntimeTask,
    type RuntimeTaskAction,
    type RuntimeTaskGeneration,
    type RuntimeTaskKind,
} from '../logic/runtimeStatusDomain'

type RuntimeContextValue = {
    setRoute:(route:string, ready:boolean) => void
    beginTask:(id:string, generation:RuntimeTaskGeneration, task:RuntimeTask) => void
    completeTask:(id:string, generation:RuntimeTaskGeneration) => void
    cancelTask:(id:string, generation:RuntimeTaskGeneration) => void
    failTask:(id:string, generation:RuntimeTaskGeneration, failure:RuntimeAssetFailure) => void
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null)

export function RuntimeStatusProvider({ children }:{ children:ReactNode }) {
    const [route, setRouteState] = useState({ name:'boot', ready:false })
    const [taskState, setTaskState] = useState(initialRuntimeTaskState)
    const taskStateRef = useRef(taskState)
    const [settled, setSettled] = useState(false)

    const applyTaskAction = useCallback((action:RuntimeTaskAction) => {
        const currentState = taskStateRef.current
        const nextState = runtimeTaskReducer(currentState, action)
        if (nextState === currentState) return false
        taskStateRef.current = nextState
        setTaskState(nextState)
        return true
    }, [])

    const setRoute = useCallback((name:string, ready:boolean) => {
        setSettled(false)
        if (!ready) applyTaskAction({ type:'dispose' })
        setRouteState(current => {
            if (!ready && current.name !== name) return current
            if (current.name === name && current.ready === ready) return current
            return { name, ready }
        })
    }, [applyTaskAction])
    const beginTask = useCallback((id:string, generation:RuntimeTaskGeneration, task:RuntimeTask) => {
        if (applyTaskAction({ type:'begin', id, generation, task })) setSettled(false)
    }, [applyTaskAction])
    const completeTask = useCallback((id:string, generation:RuntimeTaskGeneration) => {
        if (applyTaskAction({ type:'complete', id, generation })) setSettled(false)
    }, [applyTaskAction])
    const cancelTask = useCallback((id:string, generation:RuntimeTaskGeneration) => {
        if (applyTaskAction({ type:'cancel', id, generation })) setSettled(false)
    }, [applyTaskAction])
    const failTask = useCallback((id:string, generation:RuntimeTaskGeneration, nextFailure:RuntimeAssetFailure) => {
        if (!applyTaskAction({ type:'fail', id, generation, failure:nextFailure })) return
        setSettled(false)
        window.dispatchEvent(new CustomEvent('musemare:asset-failure', { detail:nextFailure }))
    }, [applyTaskAction])

    const pendingCount = getPendingRuntimeTaskCount(taskState)
    const failure = getRuntimeFailure(taskState)
    useEffect(() => {
        if (failure || !route.ready || pendingCount !== 0) return

        let secondFrame = 0
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => setSettled(true))
        })
        return () => {
            cancelAnimationFrame(firstFrame)
            cancelAnimationFrame(secondFrame)
        }
    }, [failure, pendingCount, route.name, route.ready, taskState])

    const value = useMemo<RuntimeContextValue>(() => ({
        setRoute,
        beginTask,
        completeTask,
        cancelTask,
        failTask,
    }), [beginTask, cancelTask, completeTask, failTask, setRoute])
    const status = failure ? 'failed' : settled ? 'ready' : 'loading'

    return <RuntimeContext.Provider value={value}>
        <div
            id="musemare-runtime"
            data-app-state={status}
            data-runtime-route={route.name}
            data-runtime-pending={pendingCount}
            data-runtime-failure={failure ? JSON.stringify(failure) : undefined}
        >
            {children}
            {failure && <aside className="runtime-failure" role="alert">
                <strong>Asset failed to load.</strong>
                <span>{failure.source}: {failure.message}</span>
                <button type="button" onClick={() => window.location.reload()}>Reload</button>
            </aside>}
        </div>
    </RuntimeContext.Provider>
}

export function useRuntimeStatus() {
    const runtime = useContext(RuntimeContext)
    if (!runtime) throw new Error('Runtime status is unavailable outside RuntimeStatusProvider.')
    return runtime
}

export function useRuntimeRoute(route:string, ready = true) {
    const runtime = useRuntimeStatus()
    useEffect(() => {
        runtime.setRoute(route, ready)
        return () => runtime.setRoute(route, false)
    }, [ready, route, runtime])
}

export function useRuntimeTask(kind:RuntimeTaskKind, source:string, enabled = true) {
    const runtime = useRuntimeStatus()
    const id = useId()
    const [retryNonce, setRetryNonce] = useState(0)
    const generation = useMemo(
        () => Symbol(`${enabled}:${kind}:${source}:${retryNonce}`),
        [enabled, kind, retryNonce, source],
    )

    useEffect(() => {
        if (!enabled) {
            runtime.cancelTask(id, generation)
            return
        }
        runtime.beginTask(id, generation, { kind, source })
        return () => runtime.cancelTask(id, generation)
    }, [enabled, generation, id, kind, runtime, source])

    return useMemo(() => ({
        complete:() => {
            if (enabled) runtime.completeTask(id, generation)
        },
        fail:(nextFailure:RuntimeAssetFailure) => {
            if (enabled) runtime.failTask(id, generation, nextFailure)
        },
        retry:() => setRetryNonce(current => current + 1),
    }), [enabled, generation, id, runtime])
}
