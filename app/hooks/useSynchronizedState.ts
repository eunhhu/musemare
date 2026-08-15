import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

export function useSynchronizedState<T>(initialValue:T):[
    T,
    Dispatch<SetStateAction<T>>,
    MutableRefObject<T>,
] {
    const [value, setValueState] = useState(initialValue)
    const valueRef = useRef(value)
    const setValue = useCallback<Dispatch<SetStateAction<T>>>(nextValue => {
        const resolved = typeof nextValue === 'function'
            ? (nextValue as (current:T) => T)(valueRef.current)
            : nextValue
        valueRef.current = resolved
        setValueState(resolved)
    }, [])

    return [value, setValue, valueRef]
}
