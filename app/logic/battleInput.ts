type GameplayKeyboardInput = Pick<KeyboardEvent, 'code' | 'isComposing' | 'repeat'>

export function isGameplayKeyboardInput(event:GameplayKeyboardInput) {
    return event.code.length > 0 && !event.isComposing && !event.repeat
}

export type GameplayKeyLatch = {
    press:(event:GameplayKeyboardInput) => boolean
    release:(code:string) => void
    clear:() => void
}

export function createGameplayKeyLatch():GameplayKeyLatch {
    const heldCodes = new Set<string>()

    return {
        press(event) {
            if (!isGameplayKeyboardInput(event) || heldCodes.has(event.code)) return false
            heldCodes.add(event.code)
            return true
        },
        release(code) {
            heldCodes.delete(code)
        },
        clear() {
            heldCodes.clear()
        },
    }
}
