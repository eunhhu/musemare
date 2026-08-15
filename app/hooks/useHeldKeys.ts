import { useEffect, useRef } from 'react'
import { isEditableTarget } from '../logic/input'

export function useHeldKeys(enabled = true) {
    const keysRef = useRef<string[]>([])

    useEffect(() => {
        if (!enabled) {
            keysRef.current = []
            return
        }

        const clear = () => {
            keysRef.current = []
        }
        const keydown = (event:KeyboardEvent) => {
            if (isEditableTarget(event.target) || keysRef.current.includes(event.code)) return
            keysRef.current = [...keysRef.current, event.code]
        }
        const keyup = (event:KeyboardEvent) => {
            keysRef.current = keysRef.current.filter(code => code !== event.code)
        }
        const visibilitychange = () => {
            if (document.visibilityState !== 'visible') clear()
        }

        document.addEventListener('keydown', keydown)
        document.addEventListener('keyup', keyup)
        document.addEventListener('visibilitychange', visibilitychange)
        window.addEventListener('blur', clear)
        return () => {
            document.removeEventListener('keydown', keydown)
            document.removeEventListener('keyup', keyup)
            document.removeEventListener('visibilitychange', visibilitychange)
            window.removeEventListener('blur', clear)
            clear()
        }
    }, [enabled])

    return keysRef
}
