import { describe, expect, it } from 'vitest'
import { isEditableTarget } from '../../app/logic/input'

describe('keyboard input scope', () => {
    it('ignores form fields and editable content', () => {
        expect(isEditableTarget({ tagName:'INPUT' } as unknown as EventTarget)).toBe(true)
        expect(isEditableTarget({ tagName:'textarea' } as unknown as EventTarget)).toBe(true)
        expect(isEditableTarget({ tagName:'SELECT' } as unknown as EventTarget)).toBe(true)
        expect(isEditableTarget({ tagName:'DIV', isContentEditable:true } as unknown as EventTarget)).toBe(true)
    })

    it('keeps gameplay controls active for non-editable targets', () => {
        expect(isEditableTarget({ tagName:'CANVAS' } as unknown as EventTarget)).toBe(false)
        expect(isEditableTarget(null)).toBe(false)
    })
})
