import { describe, expect, it } from 'vitest'
import { isGameplayKeyboardInput } from '../../app/logic/battleInput'

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
})
