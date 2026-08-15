import type { GameConfig } from '../config/gameConfig'
import { envForBrowserLanguage, parsePersistedEnv, type PersistedEnv } from './persistedEnv'
import type { BattleProgressTarget } from './progression'

export type GameScene = 'Intro' | 'MainMenu' | 'Settings' | 'Credits' | 'Battle' | 'Explore' | 'Selector'

export type GameSessionState = {
    scene:GameScene
    battleCode:string
    exploreCode:string
    afterBattleScene:GameScene
    battleProgressTarget:BattleProgressTarget | null
    env:PersistedEnv
}

export type InitialGameSession = {
    state:GameSessionState
    repairedEnv:boolean
}

export type GameSessionAction =
    | { type:'navigate', scene:GameScene }
    | { type:'prepare-battle', code:string, afterScene:GameScene, progressTarget:BattleProgressTarget | null }
    | { type:'start-explore', code:string }
    | { type:'update-env', env:PersistedEnv }

export function createDefaultGameSession(config:GameConfig, env = config.defaultEnv):GameSessionState {
    return {
        scene:config.startScene,
        battleCode:config.testBattleCode,
        exploreCode:config.startExploreCode,
        afterBattleScene:config.startScene,
        battleProgressTarget:null,
        env,
    }
}

export function createInitialGameSession(
    config:GameConfig,
    serializedEnv:string | null,
    browserLanguage:string | null | undefined,
    search:string,
):InitialGameSession {
    const browserDefault = envForBrowserLanguage(config.defaultEnv, browserLanguage)
    const persisted = parsePersistedEnv(serializedEnv, browserDefault)
    const state = createDefaultGameSession(config, persisted.value)
    const query = new URLSearchParams(search)
    const requestedScene = query.get('scene')

    if (requestedScene === 'Battle') {
        state.scene = 'Battle'
        state.battleCode = query.get('battle') ?? config.testBattleCode
        state.afterBattleScene = 'Selector'
    } else if (requestedScene === 'Explore') {
        state.scene = 'Explore'
        state.exploreCode = query.get('explore') ?? config.startExploreCode
    }

    return { state, repairedEnv:persisted.repaired }
}

export function gameSessionReducer(state:GameSessionState, action:GameSessionAction):GameSessionState {
    if (action.type === 'navigate') {
        return state.scene === action.scene ? state : { ...state, scene:action.scene }
    }
    if (action.type === 'prepare-battle') {
        return {
            ...state,
            battleCode:action.code,
            afterBattleScene:action.afterScene,
            battleProgressTarget:action.progressTarget,
        }
    }
    if (action.type === 'start-explore') {
        return { ...state, scene:'Explore', exploreCode:action.code }
    }
    return { ...state, env:action.env }
}
