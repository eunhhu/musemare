import { describe, expect, it } from 'vitest'
import { createGameplayKeyLatch, isGameplayKeyboardInput } from '../../app/logic/battleInput'

function key(code:string, options:Partial<{ isComposing:boolean, repeat:boolean }> = {}) {
    return {
        code,
        isComposing:options.isComposing ?? false,
        repeat:options.repeat ?? false,
    }
}

describe('battle keyboard input', () => {
    it.each(['KeyW', 'Space', 'Escape', 'ArrowLeft', 'F12', 'NumpadEnter'])(
        'accepts %s without a gameplay allowlist',
        code => expect(isGameplayKeyboardInput(key(code))).toBe(true),
    )

    it('rejects repeats, composition events, and unidentified keys', () => {
        expect(isGameplayKeyboardInput(key('KeyA', { repeat:true }))).toBe(false)
        expect(isGameplayKeyboardInput(key('KeyA', { isComposing:true }))).toBe(false)
        expect(isGameplayKeyboardInput(key(''))).toBe(false)
    })

    it('counts a held physical key only once until keyup', () => {
        const latch = createGameplayKeyLatch()

        expect(latch.press(key('KeyA'))).toBe(true)
        expect(latch.press(key('KeyA'))).toBe(false)
        latch.release('KeyA')
        expect(latch.press(key('KeyA'))).toBe(true)
    })

    it('accepts separate keys for a simultaneous chord and resets on focus loss', () => {
        const latch = createGameplayKeyLatch()

        expect(latch.press(key('KeyA'))).toBe(true)
        expect(latch.press(key('KeyS'))).toBe(true)
        latch.clear()
        expect(latch.press(key('KeyA'))).toBe(true)
        expect(latch.press(key('KeyS'))).toBe(true)
    })
})
