import { describe, expect, it } from 'vitest'
import { parseLevelJson, parseMapJson } from '../../app/logic/contentValidation'
import { levels } from '../../app/data/level'
import { maps } from '../../app/data/map'

const filters = {
    blur:0, dot:0, motionBlur:0, bloom:0, godray:0, convolution:0,
    glitch:0, grayscale:0, noise:0, pixelate:0, rgbsplit:0,
}

const player = {
    position:[0, 0], rotation:0, width:100, height:120, opacity:1,
    anchor:[0.5, 0.5], hitbox:[1, 1], src:'/player.png', jumpSrc:'', sneakSrc:'',
    sneakWalkSrc:[], runSrc:[], walkSrc:[], isGround:false, isSneak:false,
    isRun:false, showHitbox:false, dposition:[0, 0], events:[], tags:['player'],
}

describe('content import validation', () => {
    it('rejects structurally incomplete level JSON before state can be committed', () => {
        expect(() => parseLevelJson('{}')).toThrow('level.bpm must be a finite number')
        expect(() => parseLevelJson('{')).toThrow('level file must be valid JSON')
    })

    it('accepts a minimal safe level', () => {
        const level = {
            bpm:120, offset:0, song:'', backgroundColor:'#000000', volume:100,
            events:[], position:[0, 0], rotate:0, scale:1, objs:[], filters, endpoint:90,
        }
        expect(parseLevelJson(JSON.stringify(level))).toEqual(level)
    })

    it.each(['bad', 'great'] as const)('accepts the %s rhythm judgement in imported charts', judgement => {
        const level = structuredClone(levels.ending)
        const chart = level.objs.find(object => object.type === 'chart' && object.notes?.length)
        if (!chart?.notes) throw new Error('Ending chart fixture is missing notes.')
        chart.notes[0].judge = judgement

        expect(parseLevelJson(JSON.stringify(level)).objs).toContainEqual(chart)
    })

    it('reports a nested invalid map path', () => {
        const map = {
            camera:{ position:[0, 0], rotation:0, scale:1, follow:'player' },
            backgroundColor:'#000000', sprites:[{ width:'wide' }], texts:[], player,
            gravity:0.3, ground:300,
        }
        expect(() => parseMapJson(JSON.stringify(map))).toThrow('map.sprites[0].position')
    })

    it('accepts a minimal safe map', () => {
        const map = {
            camera:{ position:[0, 0], rotation:0, scale:1, follow:'player' },
            backgroundColor:'#000000', sprites:[], texts:[], player, gravity:0.3, ground:300,
        }
        expect(parseMapJson(JSON.stringify(map))).toEqual(map)
    })

    it('accepts every bundled level and map', () => {
        for (const level of Object.values(levels)) expect(parseLevelJson(JSON.stringify(level))).toEqual(level)
        for (const map of Object.values(maps)) expect(parseMapJson(JSON.stringify(map))).toEqual(map)
    })
})
