import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { gameConfig } from '../config/gameConfig'
import {
    createInitialGameSession,
    gameSessionReducer,
    type GameScene,
    type GameSessionState,
} from '../logic/gameSession'
import type { PersistedEnv } from '../logic/persistedEnv'
import type { BattleProgressTarget } from '../logic/progression'

type GameSessionContextValue = GameSessionState & {
    lang:string
    navigate:(scene:GameScene) => void
    prepareBattle:(code:string, progressTarget?:BattleProgressTarget | null, afterScene?:GameScene) => void
    startExplore:(code:string) => void
    updateEnv:(env:PersistedEnv) => void
}

const GameSessionContext = createContext<GameSessionContextValue | null>(null)

function readInitialSession() {
    let serializedEnv:string | null = null
    try {
        serializedEnv = localStorage.getItem('env')
    } catch {
        // Browser storage can be unavailable in privacy-restricted contexts.
    }
    return createInitialGameSession(gameConfig, serializedEnv, navigator.language, window.location.search)
}

export function GameSessionProvider({ children }:{ children:ReactNode }) {
    const [initial] = useState(readInitialSession)
    const [state, dispatch] = useReducer(gameSessionReducer, initial.state)

    useEffect(() => {
        if (!initial.repairedEnv) return
        try {
            localStorage.setItem('env', JSON.stringify(initial.state.env))
        } catch {
            // The in-memory session remains valid when persistence is unavailable.
        }
    }, [initial])

    const navigate = useCallback((scene:GameScene) => dispatch({ type:'navigate', scene }), [])
    const prepareBattle = useCallback((
        code:string,
        progressTarget:BattleProgressTarget | null = null,
        afterScene:GameScene = 'Selector',
    ) => dispatch({ type:'prepare-battle', code, progressTarget, afterScene }), [])
    const startExplore = useCallback((code:string) => dispatch({ type:'start-explore', code }), [])
    const updateEnv = useCallback((env:PersistedEnv) => dispatch({ type:'update-env', env }), [])

    const value = useMemo<GameSessionContextValue>(() => ({
        ...state,
        lang:state.env.language,
        navigate,
        prepareBattle,
        startExplore,
        updateEnv,
    }), [navigate, prepareBattle, startExplore, state, updateEnv])

    return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>
}

export function useGameSession() {
    const session = useContext(GameSessionContext)
    if (!session) throw new Error('Game session is unavailable outside GameSessionProvider.')
    return session
}
