import { describe, expect, it } from 'vitest'
import { gameConfig } from '../../app/config/gameConfig'
import { createInitialGameSession, gameSessionReducer } from '../../app/logic/gameSession'

describe('game session initialization', () => {
    it('hydrates valid settings and applies a battle deep link atomically', () => {
        const env = {
            ...gameConfig.defaultEnv,
            language:'ko-KR',
            volume:0.35,
        }
        const initial = createInitialGameSession(
            gameConfig,
            JSON.stringify(env),
            'en-US',
            '?scene=Battle&battle=ending',
        )

        expect(initial.repairedEnv).toBe(false)
        expect(initial.state).toMatchObject({
            scene:'Battle',
            battleCode:'ending',
            afterBattleScene:'Selector',
            battleProgressTarget:null,
            env,
        })
    })

    it('repairs malformed settings before applying an exploration deep link', () => {
        const initial = createInitialGameSession(
            gameConfig,
            '{bad json',
            'ko-KR',
            '?scene=Explore&explore=preview',
        )

        expect(initial.repairedEnv).toBe(true)
        expect(initial.state.scene).toBe('Explore')
        expect(initial.state.exploreCode).toBe('preview')
        expect(initial.state.env.language).toBe('ko-KR')
        expect(initial.state.env.volume).toBe(1)
    })
})

describe('game session transitions', () => {
    const initial = createInitialGameSession(gameConfig, null, 'en-US', '').state

    it('prepares all battle routing data in one reducer action', () => {
        const next = gameSessionReducer(initial, {
            type:'prepare-battle',
            code:'test',
            afterScene:'Selector',
            progressTarget:[0, 0],
        })

        expect(next).toMatchObject({
            scene:'MainMenu',
            battleCode:'test',
            afterBattleScene:'Selector',
            battleProgressTarget:[0, 0],
        })
        expect(initial.battleProgressTarget).toBeNull()
    })

    it('preserves referential identity for redundant navigation', () => {
        expect(gameSessionReducer(initial, { type:'navigate', scene:'MainMenu' })).toBe(initial)
    })
})
