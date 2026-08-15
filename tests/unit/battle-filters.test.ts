import { describe, expect, it } from 'vitest'
import type { filter } from '../../app/data/types'
import { BattleFilterRegistry } from '../../app/logic/battleFilters'
import type { Filter } from 'pixi.js'

const emptyFilters:filter = {
    blur:0, dot:0, motionBlur:0, bloom:0, godray:0, convolution:0,
    glitch:0, grayscale:0, noise:0, pixelate:0, rgbsplit:0,
}

describe('battle filter lifecycle', () => {
    it('reuses active filter instances across animation frames', () => {
        const created:Record<string, unknown>[] = []
        const registry = new BattleFilterRegistry(() => {
            const fake = { destroy:() => undefined }
            created.push(fake)
            return fake as unknown as Filter
        })
        const first = registry.resolve({ ...emptyFilters, blur:1 }, 0)
        const second = registry.resolve({ ...emptyFilters, blur:3 }, 0.1)

        expect(second[0]).toBe(first[0])
        expect(registry.size).toBe(1)
        expect((second[0] as unknown as { strength:number }).strength).toBe(3)
        expect(created).toHaveLength(1)

        expect(registry.resolve(emptyFilters, 0.2)).toEqual([])
        expect(registry.size).toBe(1)
        registry.destroy()
        expect(registry.size).toBe(0)
    })
})
