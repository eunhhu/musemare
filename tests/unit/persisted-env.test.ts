import { describe, expect, it } from 'vitest'
import { parsePersistedEnv, type PersistedEnv } from '../../app/logic/persistedEnv'

const defaultEnv:PersistedEnv = {
    keys:{
        playerLeft:'KeyA',
        playerRight:'KeyD',
        playerJump:'Space',
        playerRun:'ShiftLeft',
        playerSneak:'ControlLeft',
        interaction:'KeyF',
        escape:'Escape',
    },
    language:'en-US',
    volume:1,
}

const validEnv:PersistedEnv = {
    keys:{
        playerLeft:'ArrowLeft',
        playerRight:'ArrowRight',
        playerJump:'KeyZ',
        playerRun:'KeyX',
        playerSneak:'KeyC',
        interaction:'Enter',
        escape:'Escape',
    },
    language:'ko-KR',
    volume:0.35,
}

const validKeys = validEnv.keys

describe('persisted environment parsing', () => {
    it.each([
        ['missing storage', null],
        ['malformed JSON', '{'],
        ['JSON null', 'null'],
        ['an array', '[]'],
        ['a primitive', 'true'],
        ['missing keys', JSON.stringify({ language:'en-US', volume:0.5 })],
        ['the wrong keys type', JSON.stringify({ keys:'KeyA', language:'en-US', volume:0.5 })],
        ['a missing required key', JSON.stringify({ keys:{ ...validKeys, escape:undefined }, language:'en-US', volume:0.5 })],
        ['a non-string key', JSON.stringify({ keys:{ ...validKeys, escape:27 }, language:'en-US', volume:0.5 })],
        ['an unsupported language', JSON.stringify({ keys:validKeys, language:'fr-FR', volume:0.5 })],
        ['a non-string language', JSON.stringify({ keys:validKeys, language:1, volume:0.5 })],
        ['a non-number volume', JSON.stringify({ keys:validKeys, language:'en-US', volume:'0.5' })],
        ['a non-finite volume', `{"keys":${JSON.stringify(validKeys)},"language":"en-US","volume":1e309}`],
        ['a negative volume', JSON.stringify({ keys:validKeys, language:'en-US', volume:-0.01 })],
        ['a volume above one', JSON.stringify({ keys:validKeys, language:'en-US', volume:1.01 })],
    ])('repairs %s with the valid default', (_label, serialized) => {
        expect(parsePersistedEnv(serialized, defaultEnv)).toEqual({
            value:defaultEnv,
            repaired:true,
        })
    })

    it('preserves valid compatible settings', () => {
        expect(parsePersistedEnv(JSON.stringify(validEnv), defaultEnv)).toEqual({
            value:validEnv,
            repaired:false,
        })
    })
})
